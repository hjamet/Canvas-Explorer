import 'obsidian';

declare module 'obsidian' {
    interface MetadataCache {
        getBacklinksForFile(file: TFile): Record<string, Record<string, number>>;
    }
}