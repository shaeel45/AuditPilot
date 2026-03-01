import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

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
        queryKey: ["/api/repos"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/repos");
            return await res.json();
        },
    });
}

export function useAuthStatus() {
    return useQuery({
        queryKey: ["/api/auth/user"],
        queryFn: async () => {
            try {
                const res = await apiRequest("GET", "/api/auth/user");
                const data = await res.json();
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
