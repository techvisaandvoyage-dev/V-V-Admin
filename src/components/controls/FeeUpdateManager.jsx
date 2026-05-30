import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Edit3, RefreshCw, Check, X, Search } from "lucide-react";
import Button from "../ui/Button";
import Input from "../ui/Input";
import { api } from "../../store/authStore";

const FALLBACK_CURRENCIES = [
  "AED", "AFN", "ALL", "AMD", "ANG", "AOA", "ARS", "AUD", "AWG", "AZN", "BAM", "BBD", "BDT", "BGN", "BHD", "BIF",
  "BMD", "BND", "BOB", "BRL", "BSD", "BTN", "BWP", "BYN", "BZD", "CAD", "CDF", "CHF", "CLP", "CNY", "COP", "CRC",
  "CUP", "CVE", "CZK", "DJF", "DKK", "DOP", "DZD", "EGP", "ERN", "ETB", "EUR", "FJD", "FKP", "FOK", "GBP", "GEL",
  "GGP", "GHS", "GIP", "GMD", "GNF", "GTQ", "GYD", "HKD", "HNL", "HRK", "HTG", "HUF", "IDR", "ILS", "IMP", "INR",
  "IQD", "IRR", "ISK", "JEP", "JMD", "JOD", "JPY", "KES", "KGS", "KHR", "KID", "KMF", "KRW", "KWD", "KYD", "KZT",
  "LAK", "LBP", "LKR", "LRD", "LSL", "LYD", "MAD", "MDL", "MGA", "MKD", "MMK", "MNT", "MOP", "MRU", "MUR", "MVR",
  "MWK", "MXN", "MYR", "MZN", "NAD", "NGN", "NIO", "NOK", "NPR", "NZD", "OMR", "PAB", "PEN", "PGK", "PHP", "PKR",
  "PLN", "PYG", "QAR", "RON", "RSD", "RUB", "RWF", "SAR", "SBD", "SCR", "SDG", "SEK", "SGD", "SHP", "SLE", "SLL",
  "SOS", "SRD", "SSP", "STN", "SYP", "SZL", "THB", "TJS", "TMT", "TND", "TOP", "TRY", "TTD", "TVD", "TWD", "TZS",
  "UAH", "UGX", "USD", "UYU", "UZS", "VES", "VND", "VUV", "WST", "XAF", "XCD", "XDR", "XOF", "XPF", "YER", "ZAR",
  "ZMW", "ZWL"
];

const PAGE_SIZE = 10;

const formatInr = (value) => {
  const amount = Number(value);
  return `₹${(Number.isFinite(amount) ? amount : 0).toLocaleString("en-IN")}`;
};

const formatFx = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "0";
  return amount.toFixed(4).replace(/\.?0+$/, "");
};

const getCurrencyLabel = (code) => {
  try {
    const name = new Intl.DisplayNames(['en'], { type: 'currency' }).of(code);
    return `${code} - ${name}`;
  } catch (e) {
    return code;
  }
};

const toDraft = (row) => ({
  countryId: row.countryId,
  currency: row.currency || "INR",
  amount: String(row.amount ?? ""),
  forexFeePercent: String(row.forexFeePercent ?? ""),
  exchangeRate: Number(row.exchangeRate || 1),
  finalGovernmentFeeInINR: Number(row.finalGovernmentFeeInINR || 0),
  serviceFeeBeforeGST: Number(row.serviceFeeBeforeGST || 0),
  serviceFeeAfterGST: Number(row.serviceFeeAfterGST || 0),
  totalFeeInINR: Number(row.totalFeeInINR || 0),
});

const FeeUpdateManager = ({ isActive, showToast, onFeesUpdated }) => {
  const [rows, setRows] = useState([]);
  const [currencies, setCurrencies] = useState(FALLBACK_CURRENCIES);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editingRowId, setEditingRowId] = useState("");
  const [draft, setDraft] = useState(null);
  const [savingRowId, setSavingRowId] = useState("");
  const [convertingRowId, setConvertingRowId] = useState("");
  const [currencyMenuRowId, setCurrencyMenuRowId] = useState("");
  const [currencySearch, setCurrencySearch] = useState("");
  const convertSeqRef = useRef(0);

  const loadRows = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/fee-manager");
      if (data?.success) {
        setRows(Array.isArray(data.rows) ? data.rows : []);
        setCurrencies(Array.isArray(data.currencies) && data.currencies.length ? data.currencies : FALLBACK_CURRENCIES);
      } else {
        showToast("Failed to update fee", "error");
      }
    } catch (error) {
      console.error("Failed to load fee manager rows:", error);
      showToast("Failed to update fee", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isActive) return;
    loadRows();
  }, [isActive]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => String(row.countryName || "").toLowerCase().includes(term));
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, page]);

  useEffect(() => {
    if (!editingRowId || !draft) return undefined;

    const amount = Number(draft.amount);
    const forexFeePercent = Number(draft.forexFeePercent);
    if (!draft.currency || !Number.isFinite(amount) || amount < 0 || !Number.isFinite(forexFeePercent) || forexFeePercent < 0) {
      return undefined;
    }

    const seq = ++convertSeqRef.current;
    const timer = window.setTimeout(async () => {
      setConvertingRowId(editingRowId);
      try {
        const { data } = await api.post("/admin/fee-manager/convert", {
          countryId: editingRowId,
          currency: draft.currency,
          amount,
          forexFeePercent,
        });
        if (seq !== convertSeqRef.current || !data?.success) return;
        setDraft((prev) => {
          if (!prev || prev.countryId !== editingRowId) return prev;
          return {
            ...prev,
            exchangeRate: Number(data.exchangeRate || 1),
            finalGovernmentFeeInINR: Number(data.finalGovernmentFeeInINR || 0),
            serviceFeeBeforeGST: Number(data.serviceFeeBeforeGST || 0),
            serviceFeeAfterGST: Number(data.serviceFeeAfterGST || 0),
            totalFeeInINR: Number(data.totalFeeInINR || 0),
          };
        });
      } catch (error) {
        if (seq !== convertSeqRef.current) return;
        console.error("Fee conversion failed:", error);
        showToast("Currency conversion failed. Please try again.", "error");
      } finally {
        if (seq === convertSeqRef.current) setConvertingRowId("");
      }
    }, 260);

    return () => window.clearTimeout(timer);
  }, [draft?.countryId, draft?.currency, draft?.amount, draft?.forexFeePercent, editingRowId, showToast]);

  useEffect(() => {
    if (!currencyMenuRowId) return undefined;

    const handleClickOutside = (event) => {
      if (!event.target.closest(".currency-dropdown-root")) {
        setCurrencyMenuRowId("");
        setCurrencySearch("");
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [currencyMenuRowId]);

  const handleEdit = (row) => {
    setEditingRowId(row.countryId);
    setDraft(toDraft(row));
    setCurrencyMenuRowId("");
  };

  const handleCancel = () => {
    setEditingRowId("");
    setDraft(null);
    setConvertingRowId("");
    setCurrencyMenuRowId("");
    setCurrencySearch("");
    convertSeqRef.current += 1;
  };

  const handleSave = async () => {
    if (!draft || !editingRowId) return;
    const amount = Number(draft.amount);
    const forexFeePercent = Number(draft.forexFeePercent);
    if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(forexFeePercent) || forexFeePercent < 0) {
      showToast("Failed to update fee", "error");
      return;
    }

    setSavingRowId(editingRowId);
    try {
      const { data } = await api.put(`/admin/fee-manager/${editingRowId}`, {
        currency: draft.currency,
        amount,
        forexFeePercent,
      });
      if (!data?.success || !data?.row) {
        showToast("Failed to update fee", "error");
        return;
      }
      setRows((prev) => prev.map((row) => (row.countryId === editingRowId ? data.row : row)));
      showToast("Fee updated successfully", "success");
      handleCancel();
      await onFeesUpdated?.();
    } catch (error) {
      console.error("Failed to save fee manager row:", error);
      showToast("Failed to update fee", "error");
    } finally {
      setSavingRowId("");
    }
  };

  return (
    <div className="w-full max-w-none flex-1 space-y-5">
      <div className="flex w-full flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-text-primary flex items-center gap-2">
            <RefreshCw size={18} className="text-cyan" />
            Fee Update Manager
          </h2>
          <p className="text-xs text-text-muted mt-1.5 leading-relaxed">
            Manage country-wise government fee conversion, forex markup, and the live INR total without affecting the existing universal fee tabs.
          </p>
        </div>
        <div className="w-full xl:max-w-sm">
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search country name"
            leftIcon={<Search size={16} />}
          />
        </div>
      </div>

      <div className="w-full overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="hidden md:block w-full overflow-x-auto">
          <div className="min-w-full">
            <table className="w-full min-w-[1100px] table-fixed text-sm">
              <colgroup>
                <col className="w-[10%]" />
                <col className="w-[16%]" />
                <col className="w-[10%]" />
                <col className="w-[10%]" />
                <col className="w-[10%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
                <col className="w-[10%]" />
                <col className="w-[10%]" />
              </colgroup>
            <thead className="sticky top-0 z-10 bg-surface-2/95 backdrop-blur">
              <tr className="border-b border-border text-left text-xs uppercase tracking-[0.16em] text-text-muted">
                <th className="px-4 py-3 font-semibold">Action</th>
                <th className="px-4 py-3 font-semibold">Country Name</th>
                <th className="px-4 py-3 font-semibold">Currency</th>
                <th className="px-4 py-3 font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Forex Fee %</th>
                <th className="px-4 py-3 font-semibold">Final Government Fee</th>
                <th className="px-4 py-3 font-semibold">Service Fee Before GST</th>
                <th className="px-4 py-3 font-semibold">Service Fee After GST</th>
                <th className="px-4 py-3 font-semibold">Total Fee</th>
              </tr>
            </thead>
            <tbody style={{ paddingBottom: currencyMenuRowId ? "12rem" : "0" }}>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-text-muted">Loading fee manager...</td>
                </tr>
              ) : pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-text-muted">No countries found.</td>
                </tr>
              ) : (
                pagedRows.map((row) => {
                  const isEditing = editingRowId === row.countryId && draft;
                  const current = isEditing ? draft : row;
                  const isBusy = savingRowId === row.countryId || convertingRowId === row.countryId;

                  return (
                    <tr key={row.countryId} className="border-b border-border/70 align-top">
                      <td className="px-4 py-3 align-top">
                        {isEditing ? (
                          <div className="flex gap-2">
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={handleSave}
                              loading={savingRowId === row.countryId}
                              disabled={Boolean(convertingRowId === row.countryId)}
                              className="!px-2"
                              title="Save"
                            >
                              {!savingRowId && <Check size={16} />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleCancel}
                              disabled={isBusy}
                              className="!px-2"
                              title="Cancel"
                            >
                              <X size={16} />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(row)}
                            disabled={Boolean(editingRowId && editingRowId !== row.countryId)}
                            leftIcon={<Edit3 size={14} />}
                          >
                            Edit
                          </Button>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="font-medium text-text-primary break-words">{row.countryName}</div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        {isEditing ? (
                          <div className="relative inline-block w-full currency-dropdown-root">
                            <button
                              type="button"
                              className="w-full inline-flex items-center justify-between rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-text-primary transition hover:border-cyan focus:border-cyan focus:outline-none focus:ring-2 focus:ring-cyan/20"
                              onClick={() => {
                                setCurrencyMenuRowId((prev) => {
                                  if (prev === row.countryId) return "";
                                  setCurrencySearch("");
                                  return row.countryId;
                                });
                              }}
                            >
                              <span>{current.currency}</span>
                              <ChevronDown size={14} className="ml-2 text-text-muted" />
                            </button>
                            {currencyMenuRowId === row.countryId && (
                              <div className="absolute left-0 top-full mt-2 z-[60] w-[280px] max-w-[90vw] flex flex-col rounded-2xl border border-border bg-surface-2 shadow-xl overflow-hidden">
                                <div className="p-2 border-b border-border bg-surface-2">
                                  <input
                                    type="text"
                                    autoFocus
                                    placeholder="Search..."
                                    value={currencySearch}
                                    onChange={(e) => setCurrencySearch(e.target.value)}
                                    className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-text-primary focus:border-cyan focus:outline-none focus:ring-1 focus:ring-cyan/20"
                                  />
                                </div>
                                <div className="max-h-40 overflow-y-auto">
                                  {currencies.filter((c) => getCurrencyLabel(c).toLowerCase().includes(currencySearch.toLowerCase())).map((currency) => (
                                    <button
                                      key={currency}
                                      type="button"
                                      onClick={() => {
                                        setDraft((prev) => ({ ...prev, currency }));
                                        setCurrencyMenuRowId("");
                                        setCurrencySearch("");
                                      }}
                                      className={`w-full px-3 py-2 text-left text-sm whitespace-nowrap overflow-hidden text-ellipsis hover:bg-surface-3 ${current.currency === currency ? "text-cyan font-medium bg-cyan/5" : "text-text-primary"}`}
                                    >
                                      {getCurrencyLabel(currency)}
                                    </button>
                                  ))}
                                  {currencies.filter((c) => getCurrencyLabel(c).toLowerCase().includes(currencySearch.toLowerCase())).length === 0 && (
                                    <div className="px-3 py-4 text-center text-xs text-text-muted">No results found</div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-text-primary">{row.currency}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={current.amount}
                            onChange={(e) => setDraft((prev) => ({ ...prev, amount: e.target.value }))}
                            className="w-full rounded-xl border border-border bg-surface-2 px-2 py-2 text-sm text-text-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:border-cyan focus:outline-none focus:ring-2 focus:ring-cyan/20"
                          />
                        ) : (
                          <span className="text-text-primary">{Number(row.amount || 0).toLocaleString("en-IN")}</span>
                        )}
                        {isEditing && (
                          <p className="mt-1 text-[11px] text-text-muted">
                            Rate: {formatFx(current.exchangeRate)} INR
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={current.forexFeePercent}
                            onChange={(e) => setDraft((prev) => ({ ...prev, forexFeePercent: e.target.value }))}
                            className="w-full rounded-xl border border-border bg-surface-2 px-2 py-2 text-sm text-text-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:border-cyan focus:outline-none focus:ring-2 focus:ring-cyan/20"
                          />
                        ) : (
                          <span className="text-text-primary">{Number(row.forexFeePercent || 0).toLocaleString("en-IN")}%</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="font-semibold text-text-primary">{formatInr(current.finalGovernmentFeeInINR)}</div>
                        {isBusy && <p className="mt-1 text-[11px] text-cyan">Recalculating...</p>}
                      </td>
                      <td className="px-4 py-3 align-top text-text-primary">{formatInr(current.serviceFeeBeforeGST)}</td>
                      <td className="px-4 py-3 align-top text-text-primary">{formatInr(current.serviceFeeAfterGST)}</td>
                      <td className="px-4 py-3 align-top">
                        <span className="font-semibold text-cyan">{formatInr(current.totalFeeInINR)}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          </div>
        </div>

        <div className="space-y-3 p-3 md:hidden">
          {loading ? (
            <div className="rounded-2xl border border-border bg-surface-2 px-4 py-6 text-center text-text-muted">
              Loading fee manager...
            </div>
          ) : pagedRows.length === 0 ? (
            <div className="rounded-2xl border border-border bg-surface-2 px-4 py-6 text-center text-text-muted">
              No countries found.
            </div>
          ) : (
            pagedRows.map((row) => {
              const isEditing = editingRowId === row.countryId && draft;
              const current = isEditing ? draft : row;
              const isBusy = savingRowId === row.countryId || convertingRowId === row.countryId;

              return (
                <div key={row.countryId} className="rounded-2xl border border-border bg-surface-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-text-primary">{row.countryName}</p>
                      <p className="mt-1 text-xs text-text-muted">Currency: {current.currency}</p>
                    </div>
                    {isEditing ? (
                      <div className="flex gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handleSave}
                          loading={savingRowId === row.countryId}
                          disabled={Boolean(convertingRowId === row.countryId)}
                          className="!px-2"
                          title="Save"
                        >
                          {!savingRowId && <Check size={16} />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCancel}
                          disabled={isBusy}
                          className="!px-2"
                          title="Cancel"
                        >
                          <X size={16} />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(row)}
                        disabled={Boolean(editingRowId && editingRowId !== row.countryId)}
                        leftIcon={<Edit3 size={14} />}
                      >
                        Edit
                      </Button>
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3">
                    {isEditing ? (
                      <>
                        <label className="flex flex-col gap-1.5">
                          <span className="text-xs font-medium text-text-secondary">Currency</span>
                          <div className="relative w-full currency-dropdown-root">
                            <button
                              type="button"
                              className="w-full inline-flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-text-primary transition hover:border-cyan focus:border-cyan focus:outline-none focus:ring-2 focus:ring-cyan/20"
                              onClick={() => {
                                setCurrencyMenuRowId((prev) => {
                                  if (prev === row.countryId) return "";
                                  setCurrencySearch("");
                                  return row.countryId;
                                });
                              }}
                            >
                              <span>{current.currency}</span>
                              <ChevronDown size={14} className="ml-2 text-text-muted" />
                            </button>
                            {currencyMenuRowId === row.countryId && (
                              <div className="absolute left-0 top-full mt-2 z-[60] w-[280px] max-w-[90vw] flex flex-col rounded-2xl border border-border bg-surface-2 shadow-xl overflow-hidden">
                                <div className="p-2 border-b border-border bg-surface-2">
                                  <input
                                    type="text"
                                    autoFocus
                                    placeholder="Search..."
                                    value={currencySearch}
                                    onChange={(e) => setCurrencySearch(e.target.value)}
                                    className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-text-primary focus:border-cyan focus:outline-none focus:ring-1 focus:ring-cyan/20"
                                  />
                                </div>
                                <div className="max-h-40 overflow-y-auto">
                                  {currencies.filter((c) => getCurrencyLabel(c).toLowerCase().includes(currencySearch.toLowerCase())).map((currency) => (
                                    <button
                                      key={currency}
                                      type="button"
                                      onClick={() => {
                                        setDraft((prev) => ({ ...prev, currency }));
                                        setCurrencyMenuRowId("");
                                        setCurrencySearch("");
                                      }}
                                      className={`w-full px-3 py-2 text-left text-sm whitespace-nowrap overflow-hidden text-ellipsis hover:bg-surface-3 ${current.currency === currency ? "text-cyan font-medium bg-cyan/5" : "text-text-primary"}`}
                                    >
                                      {getCurrencyLabel(currency)}
                                    </button>
                                  ))}
                                  {currencies.filter((c) => getCurrencyLabel(c).toLowerCase().includes(currencySearch.toLowerCase())).length === 0 && (
                                    <div className="px-3 py-4 text-center text-xs text-text-muted">No results found</div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </label>
                        <label className="flex flex-col gap-1.5">
                          <span className="text-xs font-medium text-text-secondary">Amount</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={current.amount}
                            onChange={(e) => setDraft((prev) => ({ ...prev, amount: e.target.value }))}
                            className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-text-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:border-cyan focus:outline-none focus:ring-2 focus:ring-cyan/20"
                          />
                        </label>
                        <label className="flex flex-col gap-1.5">
                          <span className="text-xs font-medium text-text-secondary">Forex Fee %</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={current.forexFeePercent}
                            onChange={(e) => setDraft((prev) => ({ ...prev, forexFeePercent: e.target.value }))}
                            className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-text-primary focus:border-cyan focus:outline-none focus:ring-2 focus:ring-cyan/20"
                          />
                        </label>
                        <p className="text-[11px] text-text-muted">Rate: {formatFx(current.exchangeRate)} INR</p>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-text-muted">Amount</span>
                          <span className="text-text-primary">{Number(row.amount || 0).toLocaleString("en-IN")}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-text-muted">Forex Fee %</span>
                          <span className="text-text-primary">{Number(row.forexFeePercent || 0).toLocaleString("en-IN")}%</span>
                        </div>
                      </>
                    )}

                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-text-muted">Final Government Fee</span>
                      <span className="font-semibold text-text-primary">{formatInr(current.finalGovernmentFeeInINR)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-text-muted">Service Fee Before GST</span>
                      <span className="text-text-primary">{formatInr(current.serviceFeeBeforeGST)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-text-muted">Service Fee After GST</span>
                      <span className="text-text-primary">{formatInr(current.serviceFeeAfterGST)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t border-border pt-3 text-sm">
                      <span className="text-text-muted">Total Fee</span>
                      <span className="font-semibold text-cyan">{formatInr(current.totalFeeInINR)}</span>
                    </div>
                    {isBusy && <p className="text-[11px] text-cyan">Recalculating...</p>}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-border px-4 py-3 text-sm text-text-secondary sm:flex-row sm:items-center sm:justify-between">
          <p>
            Showing {filteredRows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}-
            {Math.min(page * PAGE_SIZE, filteredRows.length)} of {filteredRows.length} countries
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page <= 1}>
              Previous
            </Button>
            <span className="min-w-[88px] text-center text-xs text-text-muted">
              Page {page} / {totalPages}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={page >= totalPages}>
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeeUpdateManager;
