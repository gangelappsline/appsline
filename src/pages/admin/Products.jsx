import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { FiEdit2, FiPackage, FiSearch } from "react-icons/fi";
import LayoutAdmin from "../../layouts/LayoutAdmin";
import api from "../../services/api";

const Products = () => {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await api.get("/products");
        const payload = response.data;
        setProducts(Array.isArray(payload) ? payload : payload?.data || []);
      } catch (error) {
        console.error("Error fetching products:", error);
        setProducts([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.title?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
    );
  }, [products, query]);

  return (
    <LayoutAdmin
      title="Productos"
      subtitle={`${products.length} producto${
        products.length === 1 ? "" : "s"
      } en el catálogo`}
    >
      <div className="admin-card overflow-hidden">
        {/* Barra de herramientas */}
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <FiSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar producto o categoría..."
              className="admin-input pl-10"
            />
          </div>
          <span className="text-sm text-slate-500">
            Mostrando {filtered.length} de {products.length}
          </span>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="admin-table-head">
                <th className="px-6 py-3.5">Producto</th>
                <th className="px-6 py-3.5">Categoría</th>
                <th className="px-6 py-3.5">Precio</th>
                <th className="px-6 py-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`skeleton-${i}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-14 w-14 animate-pulse rounded-lg bg-slate-200" />
                        <div className="space-y-2">
                          <div className="h-3 w-40 animate-pulse rounded bg-slate-200" />
                          <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-5 w-20 animate-pulse rounded-full bg-slate-100" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-3 w-14 animate-pulse rounded bg-slate-200" />
                    </td>
                    <td className="px-6 py-4" />
                  </tr>
                ))}

              {!isLoading &&
                filtered.map((product) => (
                  <tr
                    key={`product-${product.id}`}
                    className="transition hover:bg-slate-50"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white">
                          {product.image ? (
                            <img
                              className="h-full w-full object-contain p-1.5"
                              alt={product.title}
                              src={product.image}
                              loading="lazy"
                            />
                          ) : (
                            <FiPackage className="text-slate-300" />
                          )}
                        </div>
                        <p className="max-w-xs truncate font-medium text-slate-800">
                          {product.title}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {product.category ? (
                        <span className="badge-brand capitalize">
                          {product.category}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-semibold tabular-nums text-slate-800">
                      ${product.price}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <NavLink
                        to={"/admin/products/" + product.id}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-brand-700 transition hover:bg-brand-50"
                      >
                        <FiEdit2 /> Editar
                      </NavLink>
                    </td>
                  </tr>
                ))}

              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center">
                    <FiPackage className="mx-auto text-3xl text-slate-300" />
                    <p className="mt-3 font-medium text-slate-700">
                      No se encontraron productos
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Ajusta la búsqueda o agrega un nuevo producto.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </LayoutAdmin>
  );
};

export default Products;
