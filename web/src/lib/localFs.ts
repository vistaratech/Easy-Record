import * as XLSX from 'xlsx';

// Polyfill for File System Access API types if needed
type FileSystemFileHandle = any;
type FileSystemDirectoryHandle = any;

export interface ExtractedExcelData {
  name: string;
  data: Record<string, string>[];
}

async function extractFilesFromDirectory(
  dirHandle: FileSystemDirectoryHandle,
  path: string = ''
): Promise<ExtractedExcelData[]> {
  let results: ExtractedExcelData[] = [];
  
  // @ts-ignore
  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file' && (entry.name.endsWith('.xlsx') || entry.name.endsWith('.xls') || entry.name.endsWith('.csv'))) {
      const fileHandle = entry as FileSystemFileHandle;
      const file = await fileHandle.getFile();
      
      const data = await new Promise<Record<string, string>[]>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const wb = XLSX.read(evt.target?.result, { type: 'binary' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, string>[];
            resolve(json);
          } catch (e) {
            reject(e);
          }
        };
        reader.onerror = reject;
        reader.readAsBinaryString(file);
      });
      
      const cleanName = entry.name.replace(/\.[^/.]+$/, '');
      const fullPathName = path ? `${path} - ${cleanName}` : cleanName;
      
      results.push({ name: fullPathName, data });
    } else if (entry.kind === 'directory') {
      const subPath = path ? `${path}/${entry.name}` : entry.name;
      const subResults = await extractFilesFromDirectory(entry, subPath);
      results = results.concat(subResults);
    }
  }
  
  return results;
}

export interface ExtractedFolder {
  folderName: string;
  files: ExtractedExcelData[];
}

export async function importLocalFolderToCloud(): Promise<ExtractedFolder | null> {
  try {
    // @ts-ignore
    const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
    const folderName = dirHandle.name;
    const extractedFiles = await extractFilesFromDirectory(dirHandle);
    return { folderName, files: extractedFiles };
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      return null;
    }
    console.error("Error reading folder:", error);
    alert("Failed to read folder contents. Please ensure browser permissions are granted.");
    return null;
  }
}
