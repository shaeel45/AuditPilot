/** Client-side shapes for the PR Manager page (mirrors the Mongoose schemas). */

export interface DraftFile {
  fileName: string;
  oldCode: string;
  newCode: string;
  status?: string;
}

export interface DraftRecord {
  _id?: string;
  title: string;
  description: string;
  filesChanged: DraftFile[];
  owner?: string;
  repo?: string;
  targetBranch?: string;
  prUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface HistoryChange {
  fileName: string;
  lineNumbers: number[];
  oldCode: string;
  newCode: string;
}

export interface HistoryRecord {
  _id?: string;
  prId: string;
  prUrl?: string;
  aiFixSummary: string;
  changes: HistoryChange[];
  createdAt?: string;
}

export const blankDraft = (): DraftRecord => ({
  title: "",
  description: "",
  filesChanged: [],
});

/** Effective status chip for a file row. */
export const fileStatus = (f: DraftFile): string => f.status || (f.newCode ? "edited" : "pending");
