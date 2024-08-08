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
		let canvasFile = this.app.vault.getAbstractFileByPath(canvasName) as TFile;

		if (!canvasFile) {
			const newCanvasFile = await this.createCanvasFile(canvasName);
			if (newCanvasFile !== null) {
				const contentUntilSecondTitle = await this.getContentUntilSecondTitle(file);
				const size = this.calculateTextSize(contentUntilSecondTitle);

				const canvasData = {
					nodes: [{
						id: "1",
						x: 0,
						y: 0,
						width: size,
						height: size,
						type: "file",
						file: file.path
					}],
					edges: []
				};
				await this.app.vault.modify(newCanvasFile, JSON.stringify(canvasData));
				canvasFile = newCanvasFile;
			} else {
				new Notice('Failed to create canvas file');
				return;
			}
		}

		this.openCanvasFile(canvasFile);
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
		const leaf = this.app.workspace.getLeaf(false); // Utilisez une méthode non dépréciée
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
				if (titleCount === 2) {
					break;
				}
			}
			result += line + '\n';
		}

		return result.trim();
	}

	calculateTextSize(text: string): number {
		const numberOfCharacters = text.length;
		const size = numberOfCharacters * 0.6; // Coefficient de 0.5, ajustez selon vos besoins
		return size;
	}
}