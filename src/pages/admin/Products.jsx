/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { FiEdit2, FiPackage } from "react-icons/fi";
import LayoutAdmin from "../../layouts/LayoutAdmin";
import { Badge, Card, EmptyState, SearchInput, TableSkeleton } from "../../components/admin";
import { fetchProducts } from "../../services/admin";
import { cx, formatCurrency } from "../../utils/format";

const Products = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setProducts(await fetchProducts());
      } catch {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter(Boolean))].sort(),
    [products]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter(
      (p) =>
        (!category || p.category === category) &&
        (!q || `${p.title || ""} ${p.category || ""}`.toLowerCase().includes(q))
    );
  }, [products, query, category]);

  return (
    <LayoutAdmin
      title="Productos"
      subtitle={`${products.length} producto${products.length === 1 ? "" : "s"} en el catálogo`}
    >
      <Card className="overflow-hidden">
        {/* Barra de herramientas */}
        <div className="space-y-3 border-b border-slate-200 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Buscar producto o categoría..."
              className="w-full sm:max-w-xs"
            />
            <span className="text-sm text-slate-500">
              Mostrando {filtered.length} de {products.length}
            </span>
          </div>
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <FilterChip active={!category} onClick={() => setCategory("")} label="Todas" />
              {categories.map((c) => (
                <FilterChip key={c} active={category === c} onClick={() => setCategory(category === c ? "" : c)} label={c} />
              ))}
            </div>
          )}
        </div>

        {/* Tabla */}
        {loading ? (
          <TableSkeleton rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FiPackage}
            title="No se encontraron productos"
            description="Ajusta la búsqueda o los filtros de categoría."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="admin-table-head">
                  <th className="px-6 py-3.5">Producto</th>
                  <th className="px-6 py-3.5">Categoría</th>
                  <th className="px-6 py-3.5">Precio</th>
                  <th className="px-6 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((product) => (
                  <tr key={`product-${product.id}`} className="transition hover:bg-slate-50">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5">
                          {product.image ? (
                            <img src={product.image} alt={product.title} loading="lazy" className="h-full w-full object-contain" />
                          ) : (
                            <FiPackage className="text-xl text-slate-300" />
                          )}
                        </span>
                        <p className="max-w-xs truncate font-medium text-slate-800">{product.title}</p>
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      {product.category ? (
                        <Badge tone="brand">{product.category}</Badge>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 font-semibold tabular-nums text-slate-800">
                      {formatCurrency(product.price, "USD")}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <NavLink
                        to={`/admin/products/${product.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-brand-700 transition hover:bg-brand-50"
                      >
                        <FiEdit2 /> Editar
                      </NavLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </LayoutAdmin>
  );
};

const FilterChip = ({ active, onClick, label }) => (
  <button
    type="button"
    onClick={onClick}
    className={cx(
      "rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition",
      active
        ? "bg-brand-600 text-white shadow-brand-sm"
        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
    )}
  >
    {label}
  </button>
);

export default Products;
