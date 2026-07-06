import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Plus, Trash2, Store, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import {
  getMySupplier,
  upsertMySupplier,
  saveProduct,
  deleteProduct,
} from "@/lib/suppliers.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/supplier-shop")({
  component: MyShop,
});

function MyShop() {
  const { t, lang } = useT();
  const qc = useQueryClient();
  const getFn = useServerFn(getMySupplier);
  const saveFn = useServerFn(upsertMySupplier);
  const saveProd = useServerFn(saveProduct);
  const delProd = useServerFn(deleteProduct);

  const { data, isLoading } = useQuery({ queryKey: ["my-supplier"], queryFn: () => getFn() });

  const [form, setForm] = useState({
    business_name: "",
    description: "",
    region: "",
    district: "",
    village: "",
    phone: "",
    whatsapp: "",
    is_active: true,
  });

  useEffect(() => {
    if (data?.supplier) {
      const s = data.supplier;
      setForm({
        business_name: s.business_name ?? "",
        description: s.description ?? "",
        region: s.region ?? "",
        district: s.district ?? "",
        village: s.village ?? "",
        phone: s.phone ?? "",
        whatsapp: s.whatsapp ?? "",
        is_active: s.is_active ?? true,
      });
    }
  }, [data?.supplier]);

  const onSaveShop = async () => {
    try {
      await saveFn({ data: form });
      toast.success(t("saved"));
      qc.invalidateQueries({ queryKey: ["my-supplier"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  // Product form (supports both create and edit)
  const emptyPf = {
    id: "" as string,
    name: "",
    category: "",
    unit: "",
    price: "",
    currency: "TZS",
    stock: "",
    description: "",
  };
  const [pf, setPf] = useState(emptyPf);
  const isEditing = !!pf.id;

  const onAddProduct = async () => {
    if (!pf.name || !pf.price) {
      toast.error(lang === "sw" ? "Jaza jina na bei" : "Fill name and price");
      return;
    }
    try {
      await saveProd({
        data: {
          ...(pf.id ? { id: pf.id } : {}),
          name: pf.name,
          category: pf.category || null,
          unit: pf.unit || null,
          price: Number(pf.price),
          currency: pf.currency || "TZS",
          stock: pf.stock ? Number(pf.stock) : null,
          description: pf.description || null,
        },
      });
      toast.success(t("saved"));
      setPf(emptyPf);
      qc.invalidateQueries({ queryKey: ["my-supplier"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onEdit = (p: {
    id: string;
    name: string;
    category: string | null;
    unit: string | null;
    price: number | string;
    currency: string | null;
    stock: number | null;
    description: string | null;
  }) => {
    setPf({
      id: p.id,
      name: p.name ?? "",
      category: p.category ?? "",
      unit: p.unit ?? "",
      price: String(p.price ?? ""),
      currency: p.currency ?? "TZS",
      stock: p.stock != null ? String(p.stock) : "",
      description: p.description ?? "",
    });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onDelete = async (id: string) => {
    try {
      await delProd({ data: { id } });
      qc.invalidateQueries({ queryKey: ["my-supplier"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Store className="h-6 w-6" />{" "}
          {data?.supplier ? t("suppliers_my_shop") : t("suppliers_register_shop")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("suppliers_ai_help")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("suppliers_register_shop")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>{t("suppliers_business_name")}</Label>
            <Input
              value={form.business_name}
              onChange={(e) => setForm({ ...form, business_name: e.target.value })}
            />
          </div>
          <div>
            <Label>{t("suppliers_description")}</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>{t("suppliers_region")}</Label>
              <Input
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
              />
            </div>
            <div>
              <Label>{t("suppliers_district")}</Label>
              <Input
                value={form.district}
                onChange={(e) => setForm({ ...form, district: e.target.value })}
              />
            </div>
            <div>
              <Label>{t("suppliers_village")}</Label>
              <Input
                value={form.village}
                onChange={(e) => setForm({ ...form, village: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>{t("suppliers_phone")}</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+255..."
              />
            </div>
            <div>
              <Label>{t("suppliers_whatsapp")}</Label>
              <Input
                value={form.whatsapp}
                onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                placeholder="+255..."
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={form.is_active}
              onCheckedChange={(v) => setForm({ ...form, is_active: v })}
            />
            <Label>{t("suppliers_active")}</Label>
          </div>
          <Button onClick={onSaveShop}>{t("save")}</Button>
        </CardContent>
      </Card>

      {data?.supplier && (
        <Card>
          <CardHeader>
            <CardTitle>{t("suppliers_products")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 border rounded-md p-3">
              <p className="font-medium text-sm">
                {isEditing
                  ? lang === "sw"
                    ? "Hariri Bidhaa"
                    : "Edit Product"
                  : t("suppliers_add_product")}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  placeholder={t("suppliers_product_name")}
                  value={pf.name}
                  onChange={(e) => setPf({ ...pf, name: e.target.value })}
                />
                <Input
                  placeholder={t("suppliers_product_category")}
                  value={pf.category}
                  onChange={(e) => setPf({ ...pf, category: e.target.value })}
                />
                <Input
                  placeholder={t("suppliers_product_unit")}
                  value={pf.unit}
                  onChange={(e) => setPf({ ...pf, unit: e.target.value })}
                />
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder={t("suppliers_product_price")}
                    value={pf.price}
                    onChange={(e) => setPf({ ...pf, price: e.target.value })}
                  />
                  <Input
                    className="w-20"
                    value={pf.currency}
                    onChange={(e) => setPf({ ...pf, currency: e.target.value })}
                  />
                </div>
                <Input
                  type="number"
                  placeholder={t("suppliers_product_stock")}
                  value={pf.stock}
                  onChange={(e) => setPf({ ...pf, stock: e.target.value })}
                />
                <Input
                  placeholder={t("finance_description")}
                  value={pf.description}
                  onChange={(e) => setPf({ ...pf, description: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={onAddProduct}>
                  {isEditing ? (
                    <Pencil className="h-4 w-4 mr-2" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  {isEditing ? t("save") : t("suppliers_add_product")}
                </Button>
                {isEditing && (
                  <Button variant="outline" onClick={() => setPf(emptyPf)}>
                    <X className="h-4 w-4 mr-2" /> {lang === "sw" ? "Ghairi" : "Cancel"}
                  </Button>
                )}
              </div>
            </div>

            {data.products.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("suppliers_no_products")}</p>
            ) : (
              <div className="space-y-2">
                {data.products.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between border rounded-md p-3"
                  >
                    <div>
                      <p className="font-medium">
                        {p.name}{" "}
                        {p.category && (
                          <span className="text-xs text-muted-foreground">({p.category})</span>
                        )}
                      </p>
                      <p className="text-sm text-primary font-semibold">
                        {Number(p.price).toLocaleString()} {p.currency}
                        {p.unit && ` / ${p.unit}`}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => onEdit(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => onDelete(p.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
