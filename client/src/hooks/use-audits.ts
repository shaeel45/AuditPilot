import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { InsertAudit, InsertAuditItem } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

// Types for creating/updating
type UpdateAuditParams = { id: string } & Partial<InsertAudit>;
type UpdateAuditItemParams = { id: string } & Partial<InsertAuditItem>;

export function useAudits() {
    return useQuery({
        queryKey: ["/api/audits"],
        queryFn: async () => {
            const res = await fetch("/api/audits");
            if (!res.ok) throw new Error("Failed to fetch audits");
            return await res.json();
        },
    });
}

export function useAudit(id: string) {
    return useQuery({
        queryKey: ["/api/audits", id],
        queryFn: async () => {
            const res = await fetch(`/api/audits/${id}`);
            if (res.status === 404) return null;
            if (!res.ok) throw new Error("Failed to fetch audit");
            return await res.json();
        },
        enabled: !!id,
    });
}

export function useCreateAudit() {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async (data: InsertAudit) => {
            const res = await fetch("/api/audits", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || "Failed to create audit");
            }
            return await res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/audits"] });
            toast({ title: "Success", description: "Audit created successfully" });
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });
}

export function useUpdateAudit() {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async ({ id, ...data }: UpdateAuditParams) => {
            const res = await fetch(`/api/audits/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error("Failed to update audit");
            return await res.json();
        },
        onSuccess: (data: any) => {
            queryClient.invalidateQueries({ queryKey: ["/api/audits"] });
            queryClient.invalidateQueries({ queryKey: ["/api/audits", data._id] });
            toast({ title: "Success", description: "Audit updated" });
        },
    });
}

export function useDeleteAudit() {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/audits/${id}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error("Failed to delete audit");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/audits"] });
            toast({ title: "Deleted", description: "Audit has been removed" });
        },
    });
}

// Audit Items Hooks

export function useCreateAuditItem(auditId: string) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async (data: Omit<InsertAuditItem, "auditId">) => {
            const res = await fetch(`/api/audits/${auditId}/items`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error("Failed to add item");
            return await res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/audits", auditId] });
            toast({ title: "Item Added", description: "Audit item created successfully" });
        },
    });
}

export function useUpdateAuditItem(auditId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, ...data }: UpdateAuditItemParams) => {
            const res = await fetch(`/api/audit-items/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error("Failed to update item");
            return await res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/audits", auditId] });
        },
    });
}

export function useDeleteAuditItem(auditId: string) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/audit-items/${id}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error("Failed to delete item");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/audits", auditId] });
            toast({ title: "Deleted", description: "Item removed" });
        },
    });
}

// AI Insights Hook

export function useGenerateInsights(auditId: string) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/audits/${auditId}/generate-insights`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });
            if (!res.ok) throw new Error("Failed to generate insights");
            return await res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/audits", auditId] });
            toast({
                title: "AI Analysis Complete",
                description: "Audit insights generated successfully",
            });
        },
        onError: (error: Error) => {
            toast({
                title: "Generation Failed",
                description: error.message,
                variant: "destructive"
            });
        }
    });
}

export function useRepoAudit() {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async ({ owner, repo }: { owner: string; repo: string }) => {
            const res = await fetch(`/api/repos/${owner}/${repo}/audit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || "Failed to perform repository audit");
            }
            return await res.json();
        },
        onSuccess: (data: any) => {
            queryClient.invalidateQueries({ queryKey: ["/api/audits"] });
            toast({
                title: "Audit Complete",
                description: `Successfully analyzed ${data.audit.title}`,
            });
        },
        onError: (error: Error) => {
            toast({
                title: "Audit Failed",
                description: error.message,
                variant: "destructive",
            });
        },
    });
}

export function useBranches(owner: string, repo: string) {
    return useQuery<string[]>({
        queryKey: ["/api/repos", owner, repo, "branches"],
        queryFn: async () => {
            if (!owner || !repo) return [];
            const res = await fetch(`/api/repos/${owner}/${repo}/branches`);
            if (!res.ok) throw new Error("Failed to fetch branches");
            return await res.json();
        },
        enabled: !!owner && !!repo,
    });
}

export function useApplyFix() {
    const { toast } = useToast();

    return useMutation({
        mutationFn: async ({ owner, repo, issues, targetBranch }: { owner: string; repo: string; issues: any[]; targetBranch: string }) => {
            const res = await fetch(`/api/repos/${owner}/${repo}/fix`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ issues, targetBranch }),
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || "Failed to apply fixes");
            }
            return await res.json();
        },
        onSuccess: (data: any) => {
            toast({
                title: "Success",
                description: `Created Pull Request: ${data.html_url.split('/').pop()}`,
            });
        },
        onError: (error: Error) => {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        },
    });
}
