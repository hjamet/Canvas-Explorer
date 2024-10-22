# 🦉 Canvas Explorer

Canvas Explorer is an Obsidian plugin that allows you to explore your vault by adding or ignoring linked notes, generating a customizable canvas.

## 🚀 Features

- Add notes to an exploration stack
- Ignore unwanted notes
- Automatically create a canvas with preserved notes and their connections
- Customizable node dimensions and canvas folder location
- Sort notes based on a frontmatter property or creation date
- Exclude specific sections from notes
- Concatenate note content in a separate node
- Color-code notes based on their connection count
- Generate a summary node with concatenated content

## 🛠️ Installation

1. Open Obsidian and go to Settings
2. Navigate to Community Plugins and disable Safe Mode
3. Click on Browse and search for "Canvas Explorer"
4. Click Install and then Enable the plugin

## 🎮 Usage

1. Open a note to start exploring
2. Use the "Add Note" command to add it to the exploration stack
3. Navigate through suggested linked notes using "Add Note" or "Ignore Note"
4. Once exploration is complete, name your canvas
5. A new canvas will be created with all preserved notes and their connections

## ⌨️ Commands

- **Add Note**: Adds the current note to the exploration stack
- **Ignore Note**: Skips the current note and moves to the next

## ⚙️ Settings

- **Canvas Folder**: Folder to save generated canvases
- **Node Width**: Width of note nodes in the canvas (in pixels)
- **Node Height**: Height of note nodes in the canvas (in pixels)
- **Sort Property**: Frontmatter property for sorting notes
- **Excluded Sections**: Section titles to exclude from concatenation

## 🎨 Color Coding

Notes are color-coded based on their number of connections:
- Red: Most connected
- Orange
- Yellow
- Purple
- Blue: Least connected

This visual cue helps identify central or highly connected notes in your knowledge graph.

## 📊 Note Sorting

Notes are sorted based on the specified frontmatter property or creation date if not found. This allows for chronological or custom-ordered exploration of your notes.

## 📝 Concatenated Summary Node

A separate, larger node is created containing the concatenated content of all explored notes. This provides a comprehensive overview of the explored topic. The summary node is color-coded green for easy identification.

## 🐛 Support

To report issues or suggest improvements, visit our [GitHub repository](https://github.com/hjamet/Canvas-Explorer).

## 👤 Author

Developed by Henri Jamet. More information at [https://www.henri-jamet.com/](https://www.henri-jamet.com/).

## 📄 License

Canvas Explorer is under the MIT License. See the LICENSE file for more details.
