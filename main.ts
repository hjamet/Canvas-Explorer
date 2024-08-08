import { MarkdownView, Notice, Plugin, TFile } from 'obsidian';

export default class NoteToCanvasPlugin extends Plugin {
	async onload() {
		this.addCommand({
			id: 'transform-note-to-canvas',
			name: 'Transform Note to Canvas',
			checkCallback: (checking: boolean) => {
				const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (activeView && activeView.file && !checking) {
					this.transformNoteToCanvas(activeView.file);
				}
				return !!activeView;
			}
		});
	}

	async transformNoteToCanvas(file: TFile) {
		if (!file) {
			new Notice('No active file');
			return;
		}

		const canvasName = `${file.basename} Canvas.canvas`;
		let canvasFile = this.app.vault.getAbstractFileByPath(canvasName) as TFile | null;

		if (!canvasFile) {
			canvasFile = await this.createCanvasFile(canvasName);
			if (!canvasFile) {
				new Notice('Failed to create canvas file');
				return;
			}

			const contentUntilSecondTitle = await this.getContentUntilSecondTitle(file);
			const size = this.calculateTextHeight(contentUntilSecondTitle);

			const backlinks = this.getLinks(file, 'backlinks');
			const forwardLinks = this.getLinks(file, 'forwardLinks');

			const backNodesResult = await this.createLinkNodes(backlinks, -600, 0);
			const forwardNodesResult = await this.createLinkNodes(forwardLinks, 600, 0);

			const backNodes = backNodesResult.nodes;
			const backTotalHeight = backNodesResult.totalHeight;
			const forwardNodes = forwardNodesResult.nodes;
			const forwardTotalHeight = forwardNodesResult.totalHeight;

			const spacing = 50; // Espace entre les nœuds
			const backYOffset = (backTotalHeight + (backlinks.length - 1) * spacing) / backlinks.length;
			const forwardYOffset = (forwardTotalHeight + (forwardLinks.length - 1) * spacing) / forwardLinks.length;

			backNodes.forEach((node: any, index: number) => {
				node.y = index * backYOffset;
			});

			forwardNodes.forEach((node: any, index: number) => {
				node.y = index * forwardYOffset;
			});

			const canvasData = {
				nodes: [
					this.createNode("1", 0, 0, 400, size, file.path),
					...backNodes,
					...forwardNodes
				],
				edges: this.createEdges(backlinks, forwardLinks)
			};

			await this.app.vault.modify(canvasFile, JSON.stringify(canvasData));
		}

		this.openCanvasFile(canvasFile);
	}

	getLinks(file: TFile, type: 'backlinks' | 'forwardLinks'): TFile[] {
		if (type === 'backlinks') {
			const resolvedLinks = this.app.metadataCache.resolvedLinks;
			return Object.entries(resolvedLinks)
				.filter(([_, targetLinks]) => targetLinks[file.path])
				.map(([sourcePath]) => this.app.vault.getAbstractFileByPath(sourcePath))
				.filter((file): file is TFile => file instanceof TFile);
		} else {
			const links = this.app.metadataCache.getFileCache(file)?.links || [];
			return links.map(link => this.app.metadataCache.getFirstLinkpathDest(link.link, file.path))
				.filter((file): file is TFile => file instanceof TFile);
		}
	}

	async createLinkNodes(links: TFile[], baseX: number, baseY: number): Promise<{ nodes: any[], totalHeight: number }> {
		const nodes = await Promise.all(links.map(async (link, index) => {
			const content = await this.getContentUntilSecondTitle(link);
			const height = this.calculateTextHeight(content);
			return this.createNode(`link-${baseX > 0 ? 'forward' : 'back'}-${index + 2}`, baseX, baseY + index * 150, 400, height, link.path);
		}));

		const totalHeight = nodes.reduce((sum, node) => sum + node.height, 0);
		return { nodes, totalHeight };
	}

	createEdges(backlinks: TFile[], forwardLinks: TFile[]): { id: string, fromNode: string, fromSide: string, toNode: string, toSide: string }[] {
		const createEdge = (id: string, fromNode: string, fromSide: string, toNode: string, toSide: string) => ({ id, fromNode, fromSide, toNode, toSide });

		return [
			...backlinks.map((_, index) => createEdge(`edge-back-${index + 1}`, `link-back-${index + 2}`, "right", "1", "left")),
			...forwardLinks.map((_, index) => createEdge(`edge-forward-${index + 1}`, "1", "right", `link-forward-${index + 2}`, "left"))
		];
	}

	async createCanvasFile(fileName: string): Promise<TFile | null> {
		try {
			return await this.app.vault.create(fileName, '');
		} catch (error) {
			console.error('Error creating canvas file:', error);
			return null;
		}
	}

	async openCanvasFile(file: TFile) {
		const leaf = this.app.workspace.getLeaf(false);
		if (leaf) {
			await leaf.openFile(file);
		} else {
			console.error('No active leaf');
		}
	}

	async getContentUntilSecondTitle(file: TFile): Promise<string> {
		const content = await this.app.vault.read(file);
		const lines = content.split('\n');
		let result = '';
		let titleCount = 0;

		for (const line of lines) {
			if (line.startsWith('#')) {
				titleCount++;
				if (titleCount === 2) break;
			}
			result += line + '\n';
		}

		return result.trim();
	}

	calculateTextHeight(text: string): number {
		const numberOfLines = text.split('\n').length;
		return numberOfLines * 50; // Assuming 50 pixels per line
	}

	createNode(id: string, x: number, y: number, width: number, height: number, filePath: string) {
		return { id, x, y, width, height, type: "file", file: filePath };
	}
}