import React from "react";
import { motion } from "framer-motion";
import { useAuthStatus } from "@/hooks/use-repos";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import DashboardLayout from "./DashboardLayout";

export default function SettingsPage() {
  const { data: authStatus } = useAuthStatus();
  const user = authStatus?.user;

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <aside className="lg:col-span-1 space-y-1">
            <Button variant="ghost" className="w-full justify-start bg-slate-100 text-slate-900 font-medium">General</Button>
            <Button variant="ghost" className="w-full justify-start text-slate-500 hover:text-slate-900">Notifications</Button>
            <Button variant="ghost" className="w-full justify-start text-slate-500 hover:text-slate-900">Security</Button>
            <Button variant="ghost" className="w-full justify-start text-slate-500 hover:text-slate-900">Advanced</Button>
          </aside>

          <div className="lg:col-span-3 space-y-8">
            <Card className="border-slate-200">
              <CardHeader className="border-b border-slate-100 py-4 px-6">
                <CardTitle className="text-base font-bold">Public Profile</CardTitle>
                <CardDescription>Your public information on AuditPilot.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="flex items-center gap-6">
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} className="w-20 h-20 rounded-full border-2 border-slate-100 shadow-sm" alt="Profile" />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-slate-200"></div>
                  )}
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">Change Photo</Button>
                      <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50 hover:text-red-600">Remove</Button>
                    </div>
                    <p className="text-xs text-slate-500">JPG, GIF or PNG. 1MB max.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">Display Name</label>
                    <input
                      type="text"
                      defaultValue={user?.displayName}
                      className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">GitHub Username</label>
                    <input
                      type="text"
                      defaultValue={user?.username}
                      disabled
                      className="w-full h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-400"
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="bg-slate-50/50 border-t border-slate-100 py-4 px-6 flex justify-end">
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700">Update Profile</Button>
              </CardFooter>
            </Card>

            <Card className="border-slate-200">
              <CardHeader className="border-b border-slate-100 py-4 px-6">
                <CardTitle className="text-base font-bold text-red-600">Danger Zone</CardTitle>
                <CardDescription>Permanent account actions.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">Delete Account</h4>
                  <p className="text-xs text-slate-500 mt-1">Once you delete your account, there is no going back. Please be certain.</p>
                </div>
                <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 hover:border-red-300">
                  Delete My Account
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </motion.div>
    </DashboardLayout>
  );
}
