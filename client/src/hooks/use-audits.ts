import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { InsertAudit, InsertAuditItem } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// Types for creating/updating
type UpdateAuditParams = { id: string } & Partial<InsertAudit>;
type UpdateAuditItemParams = { id: string } & Partial<InsertAuditItem>;

export function useAudits() {
    return useQuery({
        queryKey: ["/api/audits"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/audits");
            return await res.json();
        },
    });
}

export function useAudit(id: string) {
    return useQuery({
        queryKey: ["/api/audits", id],
        queryFn: async () => {
            try {
                const res = await apiRequest("GET", `/api/audits/${id}`);
                return await res.json();
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
        mutationFn: async (data: InsertAudit) => {
            const res = await apiRequest("POST", "/api/audits", data);
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
            const res = await apiRequest("PATCH", `/api/audits/${id}`, data);
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
            await apiRequest("DELETE", `/api/audits/${id}`);
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
            const res = await apiRequest("POST", `/api/audits/${auditId}/items`, data);
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
            const res = await apiRequest("PATCH", `/api/audit-items/${id}`, data);
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
            await apiRequest("DELETE", `/api/audit-items/${id}`);
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
            const res = await apiRequest("POST", `/api/audits/${auditId}/generate-insights`);
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
            const res = await apiRequest("POST", `/api/repos/${owner}/${repo}/audit`);
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
            const res = await apiRequest("GET", `/api/repos/${owner}/${repo}/branches`);
            return await res.json();
        },
        enabled: !!owner && !!repo,
    });
}

export function useApplyFix() {
    const { toast } = useToast();

    return useMutation({
        mutationFn: async ({ owner, repo, issues, targetBranch }: { owner: string; repo: string; issues: any[]; targetBranch: string }) => {
            const res = await apiRequest("POST", `/api/repos/${owner}/${repo}/fix`, { issues, targetBranch });
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
