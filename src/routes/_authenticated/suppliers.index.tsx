import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Store, MapPin, Phone, Plus, Search } from "lucide-react";
import { listSuppliers } from "@/lib/suppliers.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/suppliers/")({
  component: SuppliersIndex,
});

function SuppliersIndex() {
  const { t, lang } = useT();
  const fn = useServerFn(listSuppliers);
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("");
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["suppliers", search, region],
    queryFn: () => fn({ data: { search: search || undefined, region: region || undefined } }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Store className="h-6 w-6" /> {t("suppliers_title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("suppliers_subtitle")}</p>
        </div>
        <Button asChild>
          <Link to="/supplier-shop">
            <Plus className="h-4 w-4 mr-2" /> {t("suppliers_my_shop")}
          </Link>
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && refetch()}
            placeholder={lang === "sw" ? "Tafuta jina la duka..." : "Search shop name..."}
            className="pl-9"
          />
        </div>
        <Input
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && refetch()}
          placeholder={lang === "sw" ? "Mkoa (mf. Mbeya)" : "Region"}
          className="max-w-[200px]"
        />
        <Button variant="outline" onClick={() => refetch()}>
          {lang === "sw" ? "Tafuta" : "Search"}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">
          {lang === "sw" ? "Inapakia..." : "Loading..."}
        </p>
      ) : !data || data.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {t("suppliers_empty")}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map((s) => (
            <Link key={s.id} to="/suppliers/$id" params={{ id: s.id }}>
              <Card className="hover:border-primary transition-colors h-full">
                <CardHeader>
                  <CardTitle className="text-lg">{s.business_name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {s.description && (
                    <p className="text-muted-foreground line-clamp-2">{s.description}</p>
                  )}
                  {(s.region || s.district) && (
                    <p className="flex items-center gap-1 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />{" "}
                      {[s.village, s.district, s.region].filter(Boolean).join(", ")}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
