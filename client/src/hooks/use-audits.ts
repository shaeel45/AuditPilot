import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { InsertAudit, InsertAuditItem } from "@shared/types";
import { useToast } from "@/hooks/use-toast";
import { api, API_BASE } from "@/lib/api-service";

// Types for creating/updating
type UpdateAuditParams = { id: string } & Partial<InsertAudit>;
type UpdateAuditItemParams = { id: string } & Partial<InsertAuditItem>;

export function useAudits() {
    return useQuery({
        queryKey: ["audits"],
        queryFn: () => api.getAudits(),
    });
}

export function useAudit(id: string) {
    return useQuery({
        queryKey: ["audit", id],
        queryFn: async () => {
            try {
                return await api.getAuditDetails(id);
            } catch (err: any) {
                if (err.message?.includes('404')) return null;
                throw err;
            }
        },
        enabled: !!id,
    });
}

export function useCreateAudit() {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch(`${API_BASE}/api/audits`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
                credentials: "include"
            });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["audits"] });
            toast({ title: "Success", description: "Audit created successfully" });
        },
    });
}

export function useUpdateAudit() {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async ({ id, ...data }: UpdateAuditParams) => {
            return api.updateAudit(id, data);
        },
        onSuccess: (data: any) => {
            queryClient.invalidateQueries({ queryKey: ["audits"] });
            queryClient.invalidateQueries({ queryKey: ["audit", data._id] });
            toast({ title: "Success", description: "Audit updated" });
        },
    });
}

export function useDeleteAudit() {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async (id: string) => {
            await fetch(`${API_BASE}/api/audits/${id}`, {
                method: "DELETE",
                credentials: "include"
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["audits"] });
            toast({ title: "Deleted", description: "Audit has been removed" });
        },
    });
}

// Audit Items Hooks

export function useUpdateAuditItem(auditId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, ...data }: UpdateAuditItemParams) => {
            const res = await fetch(`${API_BASE}/api/audit-items/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
                credentials: "include"
            });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["audit", auditId] });
        },
    });
}

// AI Insights Hook

export function useGenerateInsights(auditId: string) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async () => {
            const res = await fetch(`${API_BASE}/api/audits/${auditId}/generate-insights`, {
                method: "POST",
                credentials: "include"
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.message || "Failed to queue AI insights");
            }
            return res.json() as Promise<{ jobId: string }>;
        },
        onSuccess: ({ jobId }) => {
            toast({ title: "AI Analysis Queued", description: "Insights are being generated…" });
            const poll = async (attempt: number = 0): Promise<void> => {
                try {
                    const job = await api.getJob(jobId);
                    if (job.state === "done") {
                        queryClient.invalidateQueries({ queryKey: ["audit", auditId] });
                        queryClient.invalidateQueries({ queryKey: ["audits"] });
                        toast({
                            title: "AI Analysis Complete",
                            description: "Audit insights generated successfully",
                        });
                        return;
                    }
                    if (job.state === "failed") {
                        toast({
                            title: "AI Analysis Failed",
                            description: job.error || "Insights could not be generated",
                            variant: "destructive",
                        });
                        return;
                    }
                    // still running — keep polling (bounded ~5 min)
                    if (attempt < 200) setTimeout(() => void poll(attempt + 1), 1500);
                } catch {
                    // transient error — keep trying while within budget
                    if (attempt < 200) setTimeout(() => void poll(attempt + 1), 2500);
                }
            };
            void poll();
        },
        onError: (error: unknown) => {
            toast({
                title: "AI Analysis Failed",
                description: error instanceof Error ? error.message : "Failed to generate insights",
                variant: "destructive",
            });
        },
    });
}

export function useBranches(owner: string, repo: string) {
    return useQuery<string[]>({
        queryKey: ["branches", owner, repo],
        queryFn: async () => {
            if (!owner || !repo) return [];
            return api.getBranches(owner, repo);
        },
        enabled: !!owner && !!repo,
    });
}

export function useApplyFix() {
    const { toast } = useToast();

    return useMutation({
        mutationFn: async ({ owner, repo, issues, targetBranch }: { owner: string; repo: string; issues: any[]; targetBranch: string }) => {
            const res = await fetch(`${API_BASE}/api/repos/${owner}/${repo}/fix`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ issues, targetBranch }),
                credentials: "include"
            });
            return res.json();
        },
        onSuccess: (data: any) => {
            toast({
                title: "Success",
                description: `Created Pull Request successfully!`,
            });
        },
    });
}
