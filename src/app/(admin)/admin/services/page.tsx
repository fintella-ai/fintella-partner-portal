"use client";

import { useState, useEffect, useCallback } from "react";

interface Service {
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
  description: string | null;
  active: boolean;
  defaultCommissionRate: number;
  firmFeeRate: number | null;
  fulfillmentType: string;
  webhookUrl: string | null;
  accentColor: string | null;
  iconEmoji: string | null;
  formFieldsConfig: any;
  createdAt: string;
  updatedAt: string;
}

type EditingService = Partial<Service> & { id?: string };

export default function AdminServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingService, setEditingService] = useState<EditingService | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchServices = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/services");
      if (!res.ok) throw new Error("Failed to fetch services");
      const data = await res.json();
      setServices(data.services || []);
    } catch (err: any) {
      setError(err.message || "Failed to load services");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const toggleActive = async (service: Service) => {
    try {
      const res = await fetch("/api/admin/services", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: service.id, active: !service.active }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setServices((prev) =>
        prev.map((s) => (s.id === service.id ? { ...s, active: !s.active } : s))
      );
    } catch {
      alert("Failed to toggle service status");
    }
  };

  const openEdit = (service: Service) => {
    setEditingService({ ...service });
    setIsNew(false);
  };

  const openNew = () => {
    setEditingService({
      name: "",
      shortName: "",
      slug: "",
      description: "",
      defaultCommissionRate: 0.25,
      firmFeeRate: null,
      fulfillmentType: "external",
      webhookUrl: "",
      accentColor: "",
      iconEmoji: "",
      formFieldsConfig: null,
    });
    setIsNew(true);
  };

  const handleSave = async () => {
    if (!editingService) return;
    setSaving(true);
    try {
      const method = isNew ? "POST" : "PATCH";
      const body = isNew
        ? {
            name: editingService.name,
            shortName: editingService.shortName || null,
            slug: editingService.slug,
            description: editingService.description || null,
            defaultCommissionRate: editingService.defaultCommissionRate ?? 0.25,
            firmFeeRate: editingService.firmFeeRate || null,
            fulfillmentType: editingService.fulfillmentType || "external",
            webhookUrl: editingService.webhookUrl || null,
            accentColor: editingService.accentColor || null,
            iconEmoji: editingService.iconEmoji || null,
            formFieldsConfig: editingService.formFieldsConfig || null,
          }
        : {
            id: editingService.id,
            name: editingService.name,
            shortName: editingService.shortName || null,
            slug: editingService.slug,
            description: editingService.description || null,
            defaultCommissionRate: editingService.defaultCommissionRate ?? 0.25,
            firmFeeRate: editingService.firmFeeRate || null,
            fulfillmentType: editingService.fulfillmentType || "external",
            webhookUrl: editingService.webhookUrl || null,
            accentColor: editingService.accentColor || null,
            iconEmoji: editingService.iconEmoji || null,
            formFieldsConfig: editingService.formFieldsConfig || null,
          };

      const res = await fetch("/api/admin/services", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Save failed");
      }
      setEditingService(null);
      fetchServices();
    } catch (err: any) {
      alert(err.message || "Failed to save service");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full bg-[var(--app-input-bg)] border border-[var(--app-input-border)] rounded-lg px-4 py-2.5 text-[var(--app-text)] font-body text-sm outline-none focus:border-brand-gold/40 transition-colors placeholder:text-[var(--app-text-muted)]";
  const labelClass =
    "font-body text-[11px] tracking-[1px] uppercase text-[var(--app-text-secondary)] mb-1.5 block";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="font-body text-sm text-[var(--app-text-muted)]">Loading services...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="font-body text-sm text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display text-[22px] font-bold mb-1">Services</h2>
          <p className="font-body text-[13px] text-[var(--app-text-muted)]">
            Manage service offerings, commission rates, and fulfillment configuration.
          </p>
        </div>
        <button
          onClick={openNew}
          className="btn-gold text-[12px] px-5 py-2.5"
        >
          + Add Service
        </button>
      </div>

      {/* Services Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--app-border)]">
                <th className="text-left font-body text-[11px] tracking-[1px] uppercase text-[var(--app-text-muted)] px-4 py-3">Name</th>
                <th className="text-left font-body text-[11px] tracking-[1px] uppercase text-[var(--app-text-muted)] px-4 py-3">Slug</th>
                <th className="text-left font-body text-[11px] tracking-[1px] uppercase text-[var(--app-text-muted)] px-4 py-3">Commission %</th>
                <th className="text-left font-body text-[11px] tracking-[1px] uppercase text-[var(--app-text-muted)] px-4 py-3">Fulfillment</th>
                <th className="text-left font-body text-[11px] tracking-[1px] uppercase text-[var(--app-text-muted)] px-4 py-3">Status</th>
                <th className="text-right font-body text-[11px] tracking-[1px] uppercase text-[var(--app-text-muted)] px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {services.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-[var(--app-text-muted)] font-body text-sm">
                    No services configured yet. Click &quot;Add Service&quot; to create one.
                  </td>
                </tr>
              )}
              {services.map((service) => (
                <tr key={service.id} className="border-b border-[var(--app-border)] hover:bg-[var(--app-hover)] transition-colors">
                  <td className="px-4 py-3 font-body text-sm text-[var(--app-text)]">
                    <div className="flex items-center gap-2">
                      {service.iconEmoji && <span>{service.iconEmoji}</span>}
                      <span className="font-medium">{service.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-body text-sm text-[var(--app-text-secondary)]">
                    <code className="bg-[var(--app-input-bg)] px-2 py-0.5 rounded text-[12px]">{service.slug}</code>
                  </td>
                  <td className="px-4 py-3 font-body text-sm text-[var(--app-text-secondary)]">
                    {Math.round(service.defaultCommissionRate * 100)}%
                  </td>
                  <td className="px-4 py-3 font-body text-sm text-[var(--app-text-secondary)] capitalize">
                    {service.fulfillmentType}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(service)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                        service.active
                          ? "bg-green-500/15 text-green-400 hover:bg-green-500/25"
                          : "bg-red-500/15 text-red-400 hover:bg-red-500/25"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${service.active ? "bg-green-400" : "bg-red-400"}`} />
                      {service.active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openEdit(service)}
                      className="font-body text-[12px] text-brand-gold/70 hover:text-brand-gold transition-colors border border-brand-gold/20 rounded-lg px-3 py-1.5 hover:bg-brand-gold/10"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit/Create Modal */}
      {editingService && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-[var(--app-border)] p-6"
            style={{ background: "var(--app-card-bg)" }}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display text-lg font-bold">
                {isNew ? "Add Service" : "Edit Service"}
              </h3>
              <button
                onClick={() => setEditingService(null)}
                className="text-[var(--app-text-muted)] hover:text-[var(--app-text)] text-xl"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Name</label>
                  <input
                    className={inputClass}
                    value={editingService.name || ""}
                    onChange={(e) => setEditingService({ ...editingService, name: e.target.value })}
                    placeholder="IEEPA Tariff Refund"
                  />
                </div>
                <div>
                  <label className={labelClass}>Short Name</label>
                  <input
                    className={inputClass}
                    value={editingService.shortName || ""}
                    onChange={(e) => setEditingService({ ...editingService, shortName: e.target.value })}
                    placeholder="IEEPA"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Slug</label>
                  <input
                    className={inputClass}
                    value={editingService.slug || ""}
                    onChange={(e) => setEditingService({ ...editingService, slug: e.target.value })}
                    placeholder="ieepa-tariff-refund"
                  />
                </div>
                <div>
                  <label className={labelClass}>Fulfillment Type</label>
                  <select
                    className={inputClass}
                    value={editingService.fulfillmentType || "external"}
                    onChange={(e) => setEditingService({ ...editingService, fulfillmentType: e.target.value })}
                  >
                    <option value="external">External</option>
                    <option value="internal">Internal</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>Description</label>
                <textarea
                  className={`${inputClass} resize-none`}
                  rows={3}
                  value={editingService.description || ""}
                  onChange={(e) => setEditingService({ ...editingService, description: e.target.value })}
                  placeholder="Service description..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>Commission Rate (%)</label>
                  <input
                    type="number"
                    className={inputClass}
                    value={Math.round((editingService.defaultCommissionRate ?? 0.25) * 100)}
                    onChange={(e) =>
                      setEditingService({
                        ...editingService,
                        defaultCommissionRate: parseFloat(e.target.value) / 100,
                      })
                    }
                    min={0}
                    max={100}
                    step={1}
                  />
                </div>
                <div>
                  <label className={labelClass}>Firm Fee Rate (%)</label>
                  <input
                    type="number"
                    className={inputClass}
                    value={editingService.firmFeeRate != null ? Math.round(editingService.firmFeeRate * 100) : ""}
                    onChange={(e) =>
                      setEditingService({
                        ...editingService,
                        firmFeeRate: e.target.value ? parseFloat(e.target.value) / 100 : null,
                      })
                    }
                    min={0}
                    max={100}
                    step={1}
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className={labelClass}>Accent Color</label>
                  <input
                    className={inputClass}
                    value={editingService.accentColor || ""}
                    onChange={(e) => setEditingService({ ...editingService, accentColor: e.target.value })}
                    placeholder="#1a365d"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Icon Emoji</label>
                  <input
                    className={inputClass}
                    value={editingService.iconEmoji || ""}
                    onChange={(e) => setEditingService({ ...editingService, iconEmoji: e.target.value })}
                    placeholder="🧮"
                  />
                </div>
                <div>
                  <label className={labelClass}>Webhook URL</label>
                  <input
                    className={inputClass}
                    value={editingService.webhookUrl || ""}
                    onChange={(e) => setEditingService({ ...editingService, webhookUrl: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Form Fields Config (JSON)</label>
                <textarea
                  className={`${inputClass} resize-none font-mono text-[12px]`}
                  rows={5}
                  value={
                    editingService.formFieldsConfig
                      ? typeof editingService.formFieldsConfig === "string"
                        ? editingService.formFieldsConfig
                        : JSON.stringify(editingService.formFieldsConfig, null, 2)
                      : ""
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    try {
                      const parsed = val ? JSON.parse(val) : null;
                      setEditingService({ ...editingService, formFieldsConfig: parsed });
                    } catch {
                      // Keep the raw string so the user can keep typing
                      setEditingService({ ...editingService, formFieldsConfig: val });
                    }
                  }}
                  placeholder='[{"name": "company", "label": "Company Name", "type": "text", "required": true}]'
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-[var(--app-border)]">
              <button
                onClick={() => setEditingService(null)}
                className="font-body text-[12px] text-[var(--app-text-muted)] border border-[var(--app-border)] rounded-lg px-4 py-2 hover:bg-[var(--app-hover)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-gold text-[12px] px-5 py-2.5 disabled:opacity-50"
              >
                {saving ? "Saving..." : isNew ? "Create Service" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
