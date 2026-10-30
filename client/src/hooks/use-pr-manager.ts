import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api-service";

/**
 * PR Manager hooks — saved drafts + audit history records.
 * Lists are queried fresh so sidebar clicks read the latest data instantly.
 */

export function useDrafts() {
    return useQuery<any[]>({
        queryKey: ["pr-drafts"],
        queryFn: () => api.listDrafts(),
    });
}

export function useAuditHistory() {
    return useQuery<any[]>({
        queryKey: ["pr-history"],
        queryFn: () => api.listAuditHistory(),
    });
}

/** Creates or updates a draft depending on whether _id is present. */
export function useSaveDraft() {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async (draft: {
            _id?: string;
            title: string;
            description: string;
            filesChanged: Array<{ fileName: string; oldCode: string; newCode: string; status?: string }>;
            owner?: string;
            repo?: string;
            targetBranch?: string;
            prUrl?: string;
        }) => {
            const { _id, ...payload } = draft;
            if (_id) return api.updateDraft(_id, payload);
            return api.createDraft(payload);
        },
        onSuccess: (data: any) => {
            queryClient.invalidateQueries({ queryKey: ["pr-drafts"] });
            toast({
                title: data?._id ? "Draft updated" : "Draft saved",
                description: "Your pull request draft is stored in MongoDB.",
            });
        },
        onError: (error: unknown) => {
            toast({
                title: "Failed to save draft",
                description: error instanceof Error ? error.message : "Please try again",
                variant: "destructive",
            });
        },
    });
}

export function useDeleteDraft() {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: (id: string) => api.deleteDraft(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["pr-drafts"] });
            toast({ title: "Draft deleted" });
        },
        onError: (error: unknown) => {
            toast({
                title: "Failed to delete draft",
                description: error instanceof Error ? error.message : "Please try again",
                variant: "destructive",
            });
        },
    });
}

export function useCreateAuditHistory() {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: (entry: {
            prId: string;
            prUrl?: string;
            aiFixSummary: string;
            changes: Array<{ fileName: string; lineNumbers: number[]; oldCode: string; newCode: string }>;
        }) => api.createAuditHistory({ ...payloadWithoutId(entry) }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["pr-history"] });
        },
        onError: (error: unknown) => {
            toast({
                title: "Failed to record audit history",
                description: error instanceof Error ? error.message : "Please try again",
                variant: "destructive",
            });
        },
    });
}

/** Applies draft snippet pairs (old→new) and opens a pull request. */
export function useRepoFix() {
    const { toast } = useToast();

    return useMutation({
        mutationFn: async ({ owner, repo, targetBranch, issues }: {
            owner: string;
            repo: string;
            targetBranch: string;
            issues: Array<{ file: string; old_code: string; new_code: string }>;
        }) => api.repoFix(owner, repo, issues, targetBranch),
        onError: (error: unknown) => {
            toast({
                title: "Pull Request failed",
                description: error instanceof Error ? error.message : "Could not create the PR from this draft",
                variant: "destructive",
            });
        },
    });
}

function payloadWithoutId<T extends Record<string, unknown>>(entry: T): T {
    const { _id, ...rest } = entry as T & { _id?: string };
    void _id;
    return rest as T;
}
