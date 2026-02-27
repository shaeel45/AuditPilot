import { useQuery } from "@tanstack/react-query";

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
            const res = await fetch("/api/repos");
            if (res.status === 401) {
                window.location.href = "/";
                return [];
            }
            if (!res.ok) throw new Error("Failed to fetch repositories");
            return await res.json();
        },
    });
}

export function useAuthStatus() {
    return useQuery({
        queryKey: ["/api/auth/user"],
        queryFn: async () => {
            const res = await fetch("/api/auth/user");
            if (!res.ok) return { authenticated: false };
            localStorage.setItem("authenticated", "true");
            return await res.json();
        },
    });
}
