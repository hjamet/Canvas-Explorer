import { App, Notice, Plugin, TFile, WorkspaceLeaf, Modal, TextComponent, ButtonComponent, PluginSettingTab, Setting } from 'obsidian';

interface MyPluginSettings {
	canvasFolder: string;
	nodeWidth: number;
	nodeHeight: number;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	canvasFolder: '',
	nodeWidth: 400,
	nodeHeight: 600
}

class MyPluginSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Dossier Canvas')
			.setDesc('Sélectionnez le dossier où enregistrer les canvas')
			.addText(text => text
				.setPlaceholder('Exemple: Dossier/Sous-dossier')
				.setValue(this.plugin.settings.canvasFolder)
				.onChange(async (value) => {
					this.plugin.settings.canvasFolder = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Largeur des nœuds')
			.setDesc('Spécifiez la largeur des nœuds dans le canvas (en pixels)')
			.addText(text => text
				.setPlaceholder('400')
				.setValue(String(this.plugin.settings.nodeWidth))
				.onChange(async (value) => {
					const numValue = Number(value);
					if (!isNaN(numValue) && numValue > 0) {
						this.plugin.settings.nodeWidth = numValue;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(containerEl)
			.setName('Hauteur des nœuds')
			.setDesc('Spécifiez la hauteur des nœuds dans le canvas (en pixels)')
			.addText(text => text
				.setPlaceholder('600')
				.setValue(String(this.plugin.settings.nodeHeight))
				.onChange(async (value) => {
					const numValue = Number(value);
					if (!isNaN(numValue) && numValue > 0) {
						this.plugin.settings.nodeHeight = numValue;
						await this.plugin.saveSettings();
					}
				}));
	}
}

export default class MyPlugin extends Plugin {
	private stack: TFile[] = [];
	private preservedNotes: TFile[] = [];
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new MyPluginSettingTab(this.app, this));

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

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
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
		let filePath = fullFileName;

		if (this.settings.canvasFolder) {
			filePath = `${this.settings.canvasFolder}/${fullFileName}`;

			// Vérifier si le dossier existe
			const folderExists = await this.app.vault.adapter.exists(this.settings.canvasFolder);

			// Si le dossier n'existe pas, le créer
			if (!folderExists) {
				try {
					await this.app.vault.adapter.mkdir(this.settings.canvasFolder);
				} catch (error) {
					new Notice(`Erreur lors de la création du dossier : ${error.message}`);
					return;
				}
			}
		}

		try {
			const canvasFile = await this.app.vault.create(filePath, canvasContent);
			await leaf.openFile(canvasFile);
		} catch (error) {
			new Notice(`Erreur lors de la création du canvas : ${error.message}`);
		}
	}

	private generateCanvasContent(): string {
		const nodes: string[] = [];
		const edges: string[] = [];
		const noteCount = this.preservedNotes.length;
		const columns = Math.ceil(Math.sqrt(noteCount));
		const nodeWidth = this.settings.nodeWidth;
		const nodeHeight = this.settings.nodeHeight;
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
				event.preventDefault();
				event.stopPropagation();
				this.submitFileName();
			}
		});

		const buttonContainer = contentEl.createDiv();
		buttonContainer.style.display = 'flex';
		buttonContainer.style.justifyContent = 'flex-end';
		buttonContainer.style.marginTop = '10px';

		new ButtonComponent(buttonContainer)
			.setButtonText('Cancel')
			.onClick(() => {
				this.close();
				this.resolve(null);
			});

		new ButtonComponent(buttonContainer)
			.setButtonText('Submit')
			.setCta()
			.onClick(() => {
				this.submitFileName();
			});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	private submitFileName() {
		const fileName = this.input.getValue();
		if (fileName) {
			this.close();
			this.resolve(fileName);
		} else {
			new Notice('Please enter a file name');
		}
	}
}