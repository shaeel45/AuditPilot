import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export function usePulls() {
    return useQuery<any[]>({
        queryKey: ["/api/pulls"],
        queryFn: async () => {
            const res = await fetch("/api/pulls");
            if (!res.ok) throw new Error("Failed to fetch Pull Requests");
            return await res.json();
        },
    });
}

export function usePRFiles(owner: string, repo: string, number: number) {
    return useQuery<any[]>({
        queryKey: ["/api/repos", owner, repo, "pulls", number, "files"],
        queryFn: async () => {
            if (!owner || !repo || !number) return [];
            const res = await fetch(`/api/repos/${owner}/${repo}/pulls/${number}/files`);
            if (!res.ok) throw new Error("Failed to fetch PR files");
            return await res.json();
        },
        enabled: !!owner && !!repo && !!number,
    });
}

export function usePRAudit() {
    return useMutation({
        mutationFn: async ({ owner, repo, number }: { owner: string; repo: string; number: number }) => {
            const res = await fetch(`/api/repos/${owner}/${repo}/pulls/${number}/audit`, {
                method: "POST",
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || "Failed to audit PR");
            }
            return await res.json();
        },
    });
}

export function usePRFix() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ owner, repo, number, issues }: { owner: string; repo: string; number: number; issues: any[] }) => {
            const res = await fetch(`/api/repos/${owner}/${repo}/pulls/${number}/fix`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ issues }),
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || "Failed to correct PR");
            }
            return await res.json();
        },
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ["/api/repos", variables.owner, variables.repo, "pulls", variables.number, "files"] });
            toast({
                title: "PR Corrected",
                description: "AI has pushed fixes to the Pull Request branch.",
            });
        },
    });
}

export function usePRMerge() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ owner, repo, number }: { owner: string; repo: string; number: number }) => {
            const res = await fetch(`/api/repos/${owner}/${repo}/pulls/${number}/merge`, {
                method: "POST",
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || "Failed to merge PR");
            }
            return await res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/pulls"] });
            toast({
                title: "Success",
                description: "Pull Request merged successfully",
            });
        },
    });
}

export function useUpdatePR() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ owner, repo, number, data }: { owner: string; repo: string; number: number; data: any }) => {
            const res = await fetch(`/api/repos/${owner}/${repo}/pulls/${number}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || "Failed to update Pull Request");
            }
            return await res.json();
        },
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ["/api/pulls"] });
            toast({
                title: "PR Updated",
                description: `Successfully updated PR #${variables.number}`,
            });
        },
    });
}
