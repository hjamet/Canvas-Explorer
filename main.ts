import { App, Notice, Plugin, TFile, WorkspaceLeaf, Modal, TextComponent, ButtonComponent, PluginSettingTab, Setting } from 'obsidian';

interface MyPluginSettings {
	canvasFolder: string;
	nodeWidth: number;
	nodeHeight: number;
	sortProperty: string;
	excludedSections: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	canvasFolder: '',
	nodeWidth: 400,
	nodeHeight: 600,
	sortProperty: 'created_at',
	excludedSections: ''
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
			.setName('Canvas Folder')
			.setDesc('Select the folder to save canvases')
			.addText(text => text
				.setPlaceholder('Example: Folder/Subfolder')
				.setValue(this.plugin.settings.canvasFolder)
				.onChange(async (value) => {
					this.plugin.settings.canvasFolder = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Node Width')
			.setDesc('Specify the width of nodes in the canvas (in pixels)')
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
			.setName('Node Height')
			.setDesc('Specify the height of nodes in the canvas (in pixels)')
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

		new Setting(containerEl)
			.setName('Sort Property')
			.setDesc('Specify the frontmatter property to use for sorting notes. If left empty or property not found, file creation date will be used.')
			.addText(text => text
				.setPlaceholder('e.g. created_at')
				.setValue(this.plugin.settings.sortProperty)
				.onChange(async (value) => {
					this.plugin.settings.sortProperty = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Excluded Sections')
			.setDesc('Specify section titles to exclude from concatenation (comma-separated)')
			.addText(text => text
				.setPlaceholder('e.g. Do not include, Private notes')
				.setValue(this.plugin.settings.excludedSections)
				.onChange(async (value) => {
					this.plugin.settings.excludedSections = value;
					await this.plugin.saveSettings();
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
			id: 'add-note',
			name: 'Add Note',
			callback: () => this.addNote(),
		});

		this.addCommand({
			id: 'ignore-note',
			name: 'Ignore Note',
			callback: () => this.ignoreNote(),
		});
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/**
	 * Adds the active file to the preserved notes.
	 */
	private async addNote() {
		const activeFile = this.app.workspace.getActiveFile();
		if (activeFile) {
			await this.preserveNote(activeFile);
		}
	}

	/**
	 * Ignores the active file and processes the next note.
	 */
	private async ignoreNote() {
		const activeFile = this.app.workspace.getActiveFile();
		if (activeFile) {
			await this.discardNote(activeFile);
		}
	}

	/**
	 * Preserves a note and processes its links.
	 * @param {TFile} file - The file to preserve.
	 */
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
		new Notice(`${this.stack.length} notes left to process.`);
		this.processNextNote();
	}

	/**
	 * Discards a note and processes the next one.
	 * @param {TFile} file - The file to discard.
	 */
	private async discardNote(file: TFile) {
		this.processNextNote();
	}

	/**
	 * Gets all links and backlinks for a given file.
	 * @param {TFile} file - The file to get links for.
	 * @returns {Promise<TFile[]>} A promise that resolves to an array of linked files.
	 */
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

		// Iterate over backlinks
		if (backlinks && backlinks.data) {
			const backlinkData = backlinks.data as unknown as Map<string, any>;
			for (const backlinkPath of backlinkData.keys()) {
				const backlinkFile = this.app.vault.getAbstractFileByPath(backlinkPath);
				if (backlinkFile instanceof TFile) {
					linkedFiles.push(backlinkFile);
				}
			}
		}

		return linkedFiles;
	}

	/**
	 * Processes the next note in the stack or creates a canvas if the stack is empty.
	 */
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

	/**
	 * Gets a file name from a modal dialog.
	 * @returns {Promise<string | null>} A promise that resolves to the file name or null if cancelled.
	 */
	private async getFileNameFromModal(): Promise<string | null> {
		return new Promise((resolve) => {
			new FileNameModal(this.app, resolve).open();
		});
	}

	/**
	 * Creates and displays a canvas with the given file name.
	 * @param {string} fileName - The name of the file to create.
	 * @param {WorkspaceLeaf} leaf - The workspace leaf to display the canvas in.
	 */
	private async createAndDisplayCanvas(fileName: string, leaf: WorkspaceLeaf) {
		const canvasContent = await this.generateCanvasContent();
		const fullFileName = `${fileName}.canvas`;
		let filePath = fullFileName;

		if (this.settings.canvasFolder) {
			filePath = `${this.settings.canvasFolder}/${fullFileName}`;

			// Check if the folder exists
			const folderExists = await this.app.vault.adapter.exists(this.settings.canvasFolder);

			// If the folder doesn't exist, create it
			if (!folderExists) {
				try {
					await this.app.vault.adapter.mkdir(this.settings.canvasFolder);
				} catch (error) {
					new Notice(`Error creating folder: ${error.message}`);
					return;
				}
			}
		}

		try {
			const canvasFile = await this.app.vault.create(filePath, canvasContent);
			await leaf.openFile(canvasFile);
		} catch (error) {
			new Notice(`Error creating canvas: ${error.message}`);
		}
	}

	/**
	 * Reads the content of a file.
	 * @param {TFile} file - The file to read.
	 * @returns {Promise<string>} A promise that resolves to the file content.
	 */
	private async readFileContent(file: TFile): Promise<string> {
		try {
			return await this.app.vault.read(file);
		} catch (error) {
			console.error(`Error reading file ${file.path}:`, error);
			return '';
		}
	}

	/**
	 * Generates the content for the canvas.
	 * @returns {Promise<string>} A promise that resolves to the canvas content.
	 */
	private async generateCanvasContent(): Promise<string> {
		const nodes: string[] = [];
		const edges: string[] = [];
		const noteCount = this.preservedNotes.length;
		const columns = Math.ceil(Math.sqrt(noteCount));
		const nodeWidth = this.settings.nodeWidth;
		const nodeHeight = this.settings.nodeHeight;
		const spacingX = 40;
		const spacingY = 40;

		// Calculate the number of connections for each note
		const connectionCounts = new Map<TFile, number>();
		for (const file of this.preservedNotes) {
			const linkedFiles = await this.getLinksAndBacklinks(file);
			connectionCounts.set(file, linkedFiles.length);
		}

		// Sort notes based on the specified property or creation date
		const sortedNotes = this.preservedNotes.sort((a, b) => {
			const valueA = this.getPropertyValue(a, this.settings.sortProperty);
			const valueB = this.getPropertyValue(b, this.settings.sortProperty);
			return valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
		});

		// Sort notes by number of connections to assign colors
		const notesByConnections = [...this.preservedNotes].sort((a, b) =>
			(connectionCounts.get(b) || 0) - (connectionCounts.get(a) || 0)
		);

		// Define colors for each percentile
		const colors = ['#FF0000', '#FFA500', '#FFFF00', '#8A2BE2', '#0000FF'];
		const getColorForNote = (file: TFile) => {
			const index = notesByConnections.indexOf(file);
			const percentile = index / notesByConnections.length;
			const colorIndex = Math.min(Math.floor(percentile * 5), 4);
			return colors[colorIndex];
		};

		// Prepare sections to exclude
		const excludedSections = this.settings.excludedSections
			.split(',')
			.map(section => section.trim())
			.filter(section => section.length > 0);

		// Function to exclude sections
		const excludeSections = (content: string): string => {
			const lines = content.split('\n');
			let result = '';
			let excluding = false;
			let currentLevel = 0;

			for (const line of lines) {
				const match = line.match(/^(#{1,6})\s+(.+)$/);
				if (match) {
					const level = match[1].length;
					const title = match[2];

					if (excludedSections.includes(title)) {
						excluding = true;
						currentLevel = level;
					} else if (level <= currentLevel) {
						excluding = false;
					}
				}

				if (!excluding) {
					result += line + '\n';
				}
			}

			return result.trim();
		};

		// Concatenate note content
		let concatenatedContent = '';
		for (const file of sortedNotes) {
			let content = await this.readFileContent(file);

			// Remove excluded sections and their content
			if (excludedSections.length > 0) {
				content = excludeSections(content);
			}

			concatenatedContent += `--- ${file.name} ---\n${content}\n\n`;
		}

		// Create nodes for each note
		sortedNotes.forEach((file, index) => {
			const x = (index % columns) * (nodeWidth + spacingX);
			const y = Math.floor(index / columns) * (nodeHeight + spacingY);
			const color = getColorForNote(file);
			nodes.push(`
        {
            "id": "node-${index}",
            "x": ${x},
            "y": ${y},
            "width": ${nodeWidth},
            "height": ${nodeHeight},
            "type": "file",
            "file": "${file.path}",
            "color": "${color}"
        }`);
		});

		// Create node for concatenated content
		const concatenatedNodeX = (columns + 1) * (nodeWidth + spacingX);
		const concatenatedNodeY = 0;
		const concatenatedNodeWidth = nodeWidth * 2 + spacingX;
		const concatenatedNodeHeight = nodeHeight * 2 + spacingY;

		nodes.push(`
      {
        "id": "node-concatenated",
        "x": ${concatenatedNodeX},
        "y": ${concatenatedNodeY},
        "width": ${concatenatedNodeWidth},
        "height": ${concatenatedNodeHeight},
        "type": "text",
        "text": ${JSON.stringify(concatenatedContent)},
        "color": "#00FF00"
      }`);

		return `{
    "nodes":[${nodes.join(',')}],
    "edges":[${edges.join(',')}]
}`;
	}

	/**
	 * Get the creation date of a file from its frontmatter.
	 * @param {TFile} file - The file to get the creation date from.
	 * @return {Date} The creation date of the file.
	 */
	private getCreationDate(file: TFile): Date {
		const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
		const createdAt = frontmatter?.created_at;
		return createdAt ? new Date(createdAt) : new Date(0);
	}

	/**
	 * Get the value of a specified property from a file's frontmatter or its creation date.
	 * @param {TFile} file - The file to get the property from.
	 * @param {string} property - The name of the property to retrieve.
	 * @return {any} The value of the property, or the file's creation date if not found.
	 */
	private getPropertyValue(file: TFile, property: string): any {
		const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
		return frontmatter?.[property] ?? file.stat.ctime;
	}

	/**
	 * Resets the plugin state.
	 */
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
