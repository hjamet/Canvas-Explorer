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
				const canvasData = {
					nodes: [{
						id: "1",
						x: 0,
						y: 0,
						width: 400,
						height: 400,
						type: "file",
						file: file.path
					}],
					edges: []
				};
				await this.app.vault.modify(newCanvasFile, JSON.stringify(canvasData));
				canvasFile = newCanvasFile; // Assurez-vous que canvasFile est défini
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
		const leaf = this.app.workspace.activeLeaf; // Utilisez le leaf actuel
		if (leaf) { // Vérifiez si leaf est défini
			await leaf.openFile(file);
		} else {
			console.error('No active leaf');
		}
	}
}