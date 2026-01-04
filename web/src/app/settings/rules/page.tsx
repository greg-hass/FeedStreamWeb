'use client';

import React, { useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, AutomationRule } from '@/lib/db';
import { Trash2, Plus, Play, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { uuidv4 } from '@/lib/utils';
import { clsx } from 'clsx';

export default function RulesPage() {
    const rules = useLiveQuery(() => db.rules.toArray()) || [];
    const [isCreating, setIsCreating] = useState(false);
    const [newRule, setNewRule] = useState<Partial<AutomationRule>>({
        name: '',
        conditionType: 'title_contains',
        conditionValue: '',
        action: 'mark_read',
        isActive: true
    });

    const handleSave = async () => {
        if (!newRule.name || !newRule.conditionValue) {
            alert("Please fill in all fields");
            return;
        }

        await db.rules.add({
            id: uuidv4(),
            name: newRule.name,
            conditionType: newRule.conditionType as any,
            conditionValue: newRule.conditionValue,
            action: newRule.action as any,
            isActive: newRule.isActive ?? true,
            createdAt: new Date()
        });

        setIsCreating(false);
        setNewRule({
            name: '',
            conditionType: 'title_contains',
            conditionValue: '',
            action: 'mark_read',
            isActive: true
        });
    };

    const handleDelete = async (id: string) => {
        if (confirm("Delete this rule?")) {
            await db.rules.delete(id);
        }
    };

    const toggleActive = async (rule: AutomationRule) => {
        await db.rules.update(rule.id, { isActive: !rule.isActive });
    };

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
            <AppHeader title="Automation Rules" showRefresh={false} />

            <div className="flex-1 max-w-3xl mx-auto w-full p-6 space-y-6">
                
                {/* Intro */}
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800 flex items-start gap-3">
                    <AlertCircle className="text-blue-500 shrink-0 mt-0.5" size={20} />
                    <div>
                        <h3 className="font-semibold text-blue-900 dark:text-blue-200">How Rules Work</h3>
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                            Rules run automatically whenever you refresh your feeds. They process new articles *before* they appear in your list.
                        </p>
                    </div>
                </div>

                {/* Create Form */}
                {isCreating ? (
                    <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4 animate-in slide-in-from-top-4">
                        <h3 className="font-semibold text-lg">New Rule</h3>
                        
                        <div>
                            <label className="block text-xs font-medium text-zinc-500 mb-1">Rule Name</label>
                            <input
                                type="text"
                                className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand"
                                placeholder="e.g. Filter Sponsorships"
                                value={newRule.name}
                                onChange={e => setNewRule({ ...newRule, name: e.target.value })}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-zinc-500 mb-1">If...</label>
                                <select
                                    className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand"
                                    value={newRule.conditionType}
                                    onChange={e => setNewRule({ ...newRule, conditionType: e.target.value as any })}
                                >
                                    <option value="title_contains">Title Contains</option>
                                    <option value="content_contains">Content Contains</option>
                                    <option value="author_contains">Author Contains</option>
                                    {/* Feed ID selector would go here in advanced version */}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-zinc-500 mb-1">Value</label>
                                <input
                                    type="text"
                                    className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand"
                                    placeholder="Text to match..."
                                    value={newRule.conditionValue}
                                    onChange={e => setNewRule({ ...newRule, conditionValue: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-zinc-500 mb-1">Then...</label>
                            <select
                                className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand"
                                value={newRule.action}
                                onChange={e => setNewRule({ ...newRule, action: e.target.value as any })}
                            >
                                <option value="mark_read">Mark as Read</option>
                                <option value="star">Star / Bookmark</option>
                                <option value="delete">Delete Permanently</option>
                            </select>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                onClick={() => setIsCreating(false)}
                                className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:brightness-110"
                            >
                                Save Rule
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={() => setIsCreating(true)}
                        className="w-full py-4 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-400 hover:text-brand hover:border-brand/30 hover:bg-brand/5 transition-all flex items-center justify-center gap-2 font-medium"
                    >
                        <Plus size={20} />
                        Create New Rule
                    </button>
                )}

                {/* Rules List */}
                <div className="space-y-3">
                    {rules.map(rule => (
                        <div key={rule.id} className={clsx(
                            "bg-white dark:bg-zinc-900 rounded-xl p-4 border shadow-sm flex items-center gap-4 transition-all",
                            rule.isActive ? "border-zinc-200 dark:border-zinc-800" : "opacity-60 border-zinc-100 dark:border-zinc-800/50"
                        )}>
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">{rule.name}</h4>
                                    {!rule.isActive && <span className="text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-zinc-500">Disabled</span>}
                                </div>
                                <div className="text-sm text-zinc-500 flex items-center gap-1.5 flex-wrap">
                                    <span className="bg-zinc-100 dark:bg-zinc-800 px-1.5 rounded border border-zinc-200 dark:border-zinc-700 text-xs">If {rule.conditionType.replace('_', ' ')}</span>
                                    <span className="font-medium text-zinc-700 dark:text-zinc-300">"{rule.conditionValue}"</span>
                                    <span>→</span>
                                    <span className={clsx(
                                        "px-1.5 rounded border text-xs font-medium",
                                        rule.action === 'delete' ? "bg-red-50 text-red-600 border-red-100" :
                                        rule.action === 'star' ? "bg-amber-50 text-amber-600 border-amber-100" :
                                        "bg-emerald-50 text-emerald-600 border-emerald-100"
                                    )}>
                                        {rule.action.replace('_', ' ')}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => toggleActive(rule)}
                                    className={clsx("p-2 rounded-lg transition-colors", rule.isActive ? "text-emerald-500 hover:bg-emerald-50" : "text-zinc-400 hover:bg-zinc-100")}
                                    title={rule.isActive ? "Disable" : "Enable"}
                                >
                                    {rule.isActive ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                                </button>
                                <button
                                    onClick={() => handleDelete(rule.id)}
                                    className="p-2 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                    title="Delete"
                                >
                                    <Trash2 size={20} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

            </div>
        </div>
    );
}
