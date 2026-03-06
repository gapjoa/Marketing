import React, { useState } from 'react';
import { Node } from '@xyflow/react';
import { NeuronData, NodeStatus, StatusLabels, StatusColors, Tag } from '../types';
import { X, ExternalLink, Save, Trash2, Mail, CheckCircle2, Loader2, Clock, XCircle, Copy } from 'lucide-react';

interface NodeSidebarProps {
  node: Node<NeuronData> | null;
  tags: Tag[];
  onClose: () => void;
  onUpdate: (id: string, data: Partial<NeuronData>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (node: Node<NeuronData>) => void;
}

const Field = ({ label, children }: { label: string, children: React.ReactNode }) => (
  <div>
    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{label}</label>
    {children}
  </div>
);

const inputCls = "w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white/50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm";

export default function NodeSidebar({ node, tags, onClose, onUpdate, onDelete, onDuplicate }: NodeSidebarProps) {
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  if (!node) return null;

  const data = node.data;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    onUpdate(node.id, { [name]: value });
  };

  const handleTagToggle = async (tagId: string) => {
    const currentTags = data.tags || [];
    const isCurrentlySelected = currentTags.includes(tagId);
    const newTags = isCurrentlySelected
      ? currentTags.filter(id => id !== tagId)
      : [...currentTags, tagId];
      
    let newValidated = data.validatedTags || [];
    let newRejected = data.rejectedTags || [];
    if (isCurrentlySelected) {
      newValidated = newValidated.filter(id => id !== tagId);
      newRejected = newRejected.filter(id => id !== tagId);
    }
    
    onUpdate(node.id, { tags: newTags, validatedTags: newValidated, rejectedTags: newRejected });

    // Auto-send email if tag is added
    if (!isCurrentlySelected) {
      const tag = tags.find(t => t.id === tagId);
      if (tag && tag.email) {
        try {
          await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: tag.email,
              subject: `Nouvelle mention : ${data.label}`,
              text: `Bonjour,\n\nVous avez été tagué sur l'action marketing "${data.label}".\n\nConnectez-vous pour voir les détails et valider.`,
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                  <h2 style="color: #4f46e5;">Nouvelle mention : ${data.label}</h2>
                  <p>Bonjour <strong>${tag.word}</strong>,</p>
                  <p>Vous avez été tagué sur l'action marketing <strong>"${data.label}"</strong>.</p>
                  <p>Connectez-vous à l'application pour voir les détails et indiquer si c'est approuvé ou à refaire.</p>
                  <p style="color: #64748b; font-size: 12px; margin-top: 30px;">L'équipe Marketing Neural Plan</p>
                </div>
              `,
            }),
          });
        } catch (error) {
          console.error('Failed to send auto-email:', error);
        }
      }
    }
  };

  const handleNotifyTags = async () => {
    if (!data.tags || data.tags.length === 0) return;
    
    setIsSending(true);
    setSendSuccess(false);

    try {
      const taggedEmails = tags
        .filter(t => data.tags?.includes(t.id))
        .map(t => t.email);

      if (taggedEmails.length === 0) return;

      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: taggedEmails.join(', '),
          subject: `Action requise : ${data.label}`,
          text: `Bonjour,\n\nVous avez été tagué sur l'action marketing "${data.label}".\n\nDescription : ${data.description || 'Aucune description'}\nStatut actuel : ${StatusLabels[data.status]}\n\nMerci de vérifier et de confirmer que tout est OK.\n\nL'équipe Marketing Neural Plan`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
              <h2 style="color: #4f46e5;">Action requise : ${data.label}</h2>
              <p>Bonjour,</p>
              <p>Vous avez été tagué sur l'action marketing <strong>"${data.label}"</strong>.</p>
              <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0;"><strong>Description :</strong><br/>${data.description || 'Aucune description'}</p>
                <p style="margin: 0;"><strong>Statut actuel :</strong> ${StatusLabels[data.status]}</p>
              </div>
              <p>Merci de vérifier et de confirmer que tout est OK.</p>
              <p style="color: #64748b; font-size: 12px; margin-top: 30px;">L'équipe Marketing Neural Plan</p>
            </div>
          `,
        }),
      });

      if (response.ok) {
        setSendSuccess(true);
        setTimeout(() => setSendSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Failed to send email:', error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed top-0 right-0 w-80 h-full glass-panel border-l flex flex-col z-50 transform transition-transform duration-300">
      <div className="flex items-center justify-between p-4 border-b border-slate-200/50 dark:border-slate-700/50">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2 font-display">
          Détails du Neurone
        </h2>
        <button onClick={onClose} className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <Field label="Titre">
          <input
            type="text"
            name="label"
            value={data.label}
            onChange={handleChange}
            className={inputCls}
            placeholder="Nom de l'action marketing"
          />
        </Field>

        <Field label="État">
          <select
            name="status"
            value={data.status}
            onChange={handleChange}
            className={inputCls}
          >
            {Object.entries(StatusLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </Field>

        <Field label="Description">
          <textarea
            name="description"
            value={data.description}
            onChange={handleChange}
            rows={4}
            className={`${inputCls} resize-none`}
            placeholder="Détails de l'action..."
          />
        </Field>

        <Field label="Équipe (Tags)">
          {tags.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 italic">Aucun tag disponible. Ajoutez-en via "Gérer l'équipe".</p>
          ) : (
            <div className="flex flex-wrap gap-2 mb-3">
              {tags.map(tag => {
                const isSelected = data.tags?.includes(tag.id);
                const isValidated = data.validatedTags?.includes(tag.id);
                const isRejected = data.rejectedTags?.includes(tag.id);
                
                let tagColorClass = 'bg-indigo-100 dark:bg-indigo-900/50 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300';
                if (isValidated) tagColorClass = 'bg-emerald-100 dark:bg-emerald-900/50 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300';
                if (isRejected) tagColorClass = 'bg-rose-100 dark:bg-rose-900/50 border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300';

                return (
                  <div
                    key={tag.id}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                      isSelected 
                        ? tagColorClass
                        : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer'
                    }`}
                    onClick={() => !isSelected && handleTagToggle(tag.id)}
                  >
                    <span 
                      onClick={(e) => { if (isSelected) { e.stopPropagation(); handleTagToggle(tag.id); } }} 
                      className={isSelected ? "cursor-pointer" : ""}
                    >
                      {tag.word}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          
          {(data.tags?.length || 0) > 0 && (
            <>
              <div className="mt-4 mb-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">Statut des validations</h4>
                <div className="space-y-2">
                  {data.tags?.map(tagId => {
                    const tag = tags.find(t => t.id === tagId);
                    if (!tag) return null;
                    const isValidated = data.validatedTags?.includes(tagId);
                    const isRejected = data.rejectedTags?.includes(tagId);
                    
                    let statusText = "En attente";
                    let statusColor = "text-slate-500 dark:text-slate-400";
                    let StatusIcon = Clock;

                    if (isValidated) {
                      statusText = "Approuvé";
                      statusColor = "text-emerald-600 dark:text-emerald-400";
                      StatusIcon = CheckCircle2;
                    } else if (isRejected) {
                      statusText = "À refaire";
                      statusColor = "text-rose-600 dark:text-rose-400";
                      StatusIcon = XCircle;
                    }

                    return (
                      <div key={tagId} className="flex items-center justify-between text-sm">
                        <span className="text-slate-700 dark:text-slate-300 font-medium">{tag.word}</span>
                        <span className={`flex items-center gap-1.5 ${statusColor} text-xs font-semibold`}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          {statusText}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={handleNotifyTags}
                disabled={isSending}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-70"
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : sendSuccess ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Mail className="w-4 h-4" />
                )}
                {sendSuccess ? 'Relances envoyées !' : 'Relancer les personnes taguées'}
              </button>
            </>
          )}
        </Field>

        <Field label="Couleur personnalisée">
          <div className="flex items-center gap-3">
            <input
              type="color"
              name="customColor"
              value={data.customColor || StatusColors[data.status]}
              onChange={handleChange}
              className="w-10 h-10 p-0.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 cursor-pointer"
            />
            <button
              onClick={() => onUpdate(node.id, { customColor: '' })}
              className="text-xs px-3 py-1.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
            >
              Auto (Statut)
            </button>
          </div>
        </Field>

        <Field label="Taille personnalisée">
          <div className="flex items-center gap-3">
            <input
              type="range"
              name="customSize"
              min="80"
              max="400"
              value={data.customSize || (128 + (data.connectionsCount || 0) * 20)}
              onChange={(e) => onUpdate(node.id, { customSize: parseInt(e.target.value, 10) })}
              className="flex-1 accent-indigo-500"
            />
            <span className="text-xs font-mono text-slate-500 w-10 text-right">
              {data.customSize || (128 + (data.connectionsCount || 0) * 20)}px
            </span>
            <button
              onClick={() => onUpdate(node.id, { customSize: 0 })}
              className="text-xs px-3 py-1.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
            >
              Auto
            </button>
          </div>
        </Field>

        <Field label="Lien de la ressource">
          <div className="flex gap-2">
            <input
              type="url"
              name="resourceLink"
              value={data.resourceLink}
              onChange={handleChange}
              className={inputCls}
              placeholder="https://..."
            />
            {data.resourceLink && (
              <a
                href={data.resourceLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                title="Ouvrir le lien"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        </Field>
      </div>

      <div className="p-4 border-t border-slate-200/50 dark:border-slate-700/50 flex flex-col gap-2">
        {isConfirmingDelete ? (
          <div className="flex flex-col gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800/50">
            <p className="text-sm text-red-800 dark:text-red-300 font-medium text-center">Voulez-vous vraiment supprimer ce neurone ?</p>
            <div className="flex gap-2">
              <button
                onClick={() => setIsConfirmingDelete(false)}
                className="flex-1 px-3 py-1.5 text-sm font-medium rounded-md text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  onDelete(node.id);
                  onClose();
                }}
                className="flex-1 px-3 py-1.5 text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 transition-colors"
              >
                Oui, supprimer
              </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-between gap-2">
            <button
              onClick={() => setIsConfirmingDelete(true)}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-offset-slate-900 transition-colors"
              title="Supprimer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                onDuplicate(node);
              }}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/30 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-slate-900 transition-colors"
              title="Dupliquer"
            >
              <Copy className="w-4 h-4 mr-2" />
              Dupliquer
            </button>
            <button
              onClick={onClose}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-slate-900 transition-colors"
            >
              <Save className="w-4 h-4 mr-2" />
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
