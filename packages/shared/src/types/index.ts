// Common API and Domain Types

type User = {
    id: string;
    name: string;
    email: string;
};

type Post = {
    id: string;
    title: string;
    content: string;
    author: User;
};

export type { User, Post };