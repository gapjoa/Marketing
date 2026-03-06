import React, { useState } from 'react';
import { Tag } from '../types';
import { X, Plus, Trash2, Mail } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface TeamManagerProps {
  tags: Tag[];
  onAddTag: (tag: Tag) => void;
  onDeleteTag: (id: string) => void;
  onClose: () => void;
}

export default function TeamManager({ tags, onAddTag, onDeleteTag, onClose }: TeamManagerProps) {
  const [word, setWord] = useState('');
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!word.trim() || !email.trim()) return;

    onAddTag({
      id: uuidv4(),
      word: word.trim(),
      email: email.trim(),
    });

    setWord('');
    setEmail('');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2 font-display">
            <Mail className="w-5 h-5 text-indigo-500" />
            Gestion de l'équipe (Tags)
          </h2>
          <button onClick={onClose} className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 mb-6">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Mot-clé (ex: Design, @jean)"
                value={word}
                onChange={(e) => setWord(e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={!word.trim() || !email.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Ajouter le tag
            </button>
          </form>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
            {tags.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                Aucun tag configuré. Ajoutez-en un ci-dessus.
              </p>
            ) : (
              tags.map((tag) => (
                <div key={tag.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                  <div>
                    <span className="inline-block px-2 py-1 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs font-semibold rounded-md mr-2">
                      {tag.word}
                    </span>
                    <span className="text-sm text-slate-600 dark:text-slate-400">{tag.email}</span>
                  </div>
                  <button
                    onClick={() => onDeleteTag(tag.id)}
                    className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-md transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
