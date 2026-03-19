import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api-service";

export function usePulls() {
    return useQuery<any[]>({
        queryKey: ["pulls"],
        queryFn: () => api.getPulls(),
    });
}

export function usePRFiles(owner: string, repo: string, number: number) {
    return useQuery<any[]>({
        queryKey: ["pull-files", owner, repo, number],
        queryFn: async () => {
            if (!owner || !repo || !number) return [];
            return api.getPullFiles(owner, repo, number.toString());
        },
        enabled: !!owner && !!repo && !!number,
    });
}

export function usePRAudit() {
    return useMutation({
        mutationFn: async ({ owner, repo, number }: { owner: string; repo: string; number: number }) => {
            return api.auditPull(owner, repo, number);
        },
    });
}

export function usePRFix() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ owner, repo, number, issues }: { owner: string; repo: string; number: number; issues: any[] }) => {
            return api.fixPull(owner, repo, number, issues);
        },
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ["pull-files", variables.owner, variables.repo, variables.number] });
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
            return api.mergePull(owner, repo, number);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["pulls"] });
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
            return api.updatePull(owner, repo, number, data);
        },
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ["pulls"] });
            toast({
                title: "PR Updated",
                description: `Successfully updated PR #${variables.number}`,
            });
        },
    });
}
