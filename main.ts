import { App, Notice, Plugin, TFile, WorkspaceLeaf, Modal, TextComponent, ButtonComponent } from 'obsidian';

export default class MyPlugin extends Plugin {
	private stack: TFile[] = [];
	private preservedNotes: TFile[] = [];

	async onload() {
		this.addCommand({
			id: 'ajouter-note',
			name: 'Ajouter Note',
			callback: () => this.addNote(),
		});

		this.addCommand({
			id: 'ignorer-note',
			name: 'Ignorer Note',
			callback: () => this.ignoreNote(),
		});
	}

	private async addNote() {
		const activeFile = this.app.workspace.getActiveFile();
		if (activeFile) {
			await this.preserveNote(activeFile);
		}
	}

	private async ignoreNote() {
		const activeFile = this.app.workspace.getActiveFile();
		if (activeFile) {
			await this.discardNote(activeFile);
		}
	}

	private async preserveNote(file: TFile) {
		if (!this.preservedNotes.includes(file)) {
			this.preservedNotes.push(file);

			const linkedFiles = await this.getLinksAndBacklinks(file);
			for (const linkedFile of linkedFiles) {
				if (!this.stack.includes(linkedFile) && !this.preservedNotes.includes(linkedFile)) {
					this.stack.push(linkedFile);
				}
			}
		}
		// Ajouter une notice pour le nombre de notes restantes
		new Notice(`Il reste ${this.stack.length} notes à traiter.`);
		this.processNextNote();
	}

	private async discardNote(file: TFile) {
		this.processNextNote();
	}

	private async getLinksAndBacklinks(file: TFile): Promise<TFile[]> {
		const linkedFiles: TFile[] = [];
		const links = this.app.metadataCache.getFileCache(file)?.links || [];
		const backlinks = this.app.metadataCache.getBacklinksForFile(file);

		for (const link of links) {
			const linkedFilePath = this.app.metadataCache.getFirstLinkpathDest(link.link, file.path);
			if (linkedFilePath) {
				const linkedFile = this.app.vault.getAbstractFileByPath(linkedFilePath.path);
				if (linkedFile instanceof TFile) {
					linkedFiles.push(linkedFile);
				}
			}
		}

		for (const backlink of Object.keys(backlinks.data)) {
			const backlinkFile = this.app.vault.getAbstractFileByPath(backlink);
			if (backlinkFile instanceof TFile) {
				linkedFiles.push(backlinkFile);
			}
		}

		return linkedFiles;
	}

	private async processNextNote() {
		if (this.stack.length > 0) {
			const nextFile = this.stack.shift();
			if (nextFile) {
				await this.app.workspace.getLeaf().openFile(nextFile);
			}
		} else {
			const fileName = await this.getFileNameFromModal();
			if (fileName) {
				await this.createAndDisplayCanvas(fileName, this.app.workspace.getLeaf());
			}
			this.resetPlugin();
		}
	}

	private async getFileNameFromModal(): Promise<string | null> {
		return new Promise((resolve) => {
			new FileNameModal(this.app, resolve).open();
		});
	}

	private async createAndDisplayCanvas(fileName: string, leaf: WorkspaceLeaf) {
		const canvasContent = this.generateCanvasContent();
		const fullFileName = `${fileName}.canvas`;
		const canvasFile = await this.app.vault.create(fullFileName, canvasContent);
		await leaf.openFile(canvasFile);
	}

	private generateCanvasContent(): string {
		const nodes: string[] = [];
		const edges: string[] = [];
		const noteCount = this.preservedNotes.length;
		const columns = Math.ceil(Math.sqrt(noteCount));
		const rows = Math.ceil(noteCount / columns);
		const nodeWidth = 400;
		const nodeHeight = 600;
		const spacingX = 40;
		const spacingY = 40;

		this.preservedNotes.forEach((file, index) => {
			const x = (index % columns) * (nodeWidth + spacingX);
			const y = Math.floor(index / columns) * (nodeHeight + spacingY);
			nodes.push(`
			{
				"id": "node-${index}",
				"x": ${x},
				"y": ${y},
				"width": ${nodeWidth},
				"height": ${nodeHeight},
				"type": "file",
				"file": "${file.path}"
			}`);
		});

		return `{
		"nodes":[${nodes.join(',')}],
		"edges":[${edges.join(',')}]
	}`;
	}

	private resetPlugin() {
		this.stack = [];
		this.preservedNotes = [];
	}
}

class FileNameModal extends Modal {
	private resolve: (value: string | null) => void;
	private input: TextComponent;

	constructor(app: App, resolve: (value: string | null) => void) {
		super(app);
		this.resolve = resolve;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl('h2', { text: 'Enter the file name' });

		this.input = new TextComponent(contentEl);
		this.input.inputEl.style.width = '100%';
		this.input.inputEl.focus();

		this.input.inputEl.addEventListener('keydown', (event: KeyboardEvent) => {
			if (event.key === 'Enter') {
				event.preventDefault(); // Empêche l'action par défaut de l'événement
				event.stopPropagation(); // Empêche la propagation de l'événement
				this.submitFileName();
			}
		});

		const buttonContainer = contentEl.createDiv();
		buttonContainer.style.display = 'flex';
		buttonContainer.style.justifyContent = 'space-between';
		buttonContainer.style.marginTop = '1rem';

		const submitButton = new ButtonComponent(buttonContainer);
		submitButton.setButtonText('Submit').onClick(() => this.submitFileName());

		const cancelButton = new ButtonComponent(buttonContainer);
		cancelButton.setButtonText('Cancel').onClick(() => {
			this.resolve(null);
			this.close();
		});
	}

	private submitFileName() {
		const fileName = this.input.getValue().trim();
		if (fileName) {
			this.resolve(fileName);
			this.close();
		} else {
			new Notice('File name cannot be empty');
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}