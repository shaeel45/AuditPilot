import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-service";

interface GitHubRepo {
    id: number;
    name: string;
    full_name: string;
    description: string;
    stargazers_count: number;
    language: string;
    updated_at: string;
    html_url: string;
    default_branch: string;
}

export function useRepos() {
    return useQuery<GitHubRepo[]>({
        queryKey: ["repos"],
        queryFn: () => api.getRepos(),
    });
}

export function useAuthStatus() {
    return useQuery({
        queryKey: ["auth-status"],
        queryFn: async () => {
            try {
                const data = await api.getAuthStatus();
                if (data.authenticated) {
                    localStorage.setItem("authenticated", "true");
                } else {
                    localStorage.removeItem("authenticated");
                }
                return data;
            } catch (err) {
                localStorage.removeItem("authenticated");
                return { authenticated: false };
            }
        },
        retry: false
    });
}
