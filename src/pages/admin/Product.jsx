import { useEffect, useState } from "react";
import { NavLink, useParams } from "react-router-dom";
import { FiArrowLeft, FiImage, FiSave } from "react-icons/fi";
import LayoutAdmin from "../../layouts/LayoutAdmin";
import { Button, Card, CardHeader, EmptyState, Field, useToast } from "../../components/admin";
import { fetchProduct, updateProduct } from "../../services/admin";

const Product = () => {
  const { id } = useParams();
  const { notify } = useToast();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchProduct(id);
        if (!data) setNotFound(true);
        else setProduct(data);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const set = (key) => (e) =>
    setProduct((p) => ({ ...p, [key]: e.target.value }));

  const handleSave = async () => {
    if (!product) return;
    setSaving(true);
    try {
      const saved = await updateProduct(id, {
        title: product.title,
        category: product.category,
        price: Number(product.price) || 0,
        description: product.description,
        image: product.image,
      });
      setProduct((p) => ({ ...p, ...saved }));
      notify("Producto actualizado");
    } catch {
      notify("No se pudo guardar el producto", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <LayoutAdmin title="Producto">
        <Card className="p-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-5 lg:col-span-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
                  <div className="h-11 w-full animate-pulse rounded-xl bg-slate-100" />
                </div>
              ))}
            </div>
            <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
          </div>
        </Card>
      </LayoutAdmin>
    );
  }

  if (notFound || !product) {
    return (
      <LayoutAdmin title="Producto">
        <Card>
          <EmptyState
            icon={FiImage}
            title="Producto no encontrado"
            description="El producto que buscas no existe o fue eliminado."
            action={
              <NavLink to="/admin/products" className="btn-secondary">
                <FiArrowLeft /> Volver a productos
              </NavLink>
            }
          />
        </Card>
      </LayoutAdmin>
    );
  }

  return (
    <LayoutAdmin
      title={product.title || "Producto"}
      subtitle="Edita la información del producto"
      breadcrumbs={[{ label: "Productos", to: "/admin/products" }, { label: product.title || `#${id}` }]}
      actions={
        <>
          <NavLink to="/admin/products" className="btn-secondary">
            <FiArrowLeft /> Volver
          </NavLink>
          <Button loading={saving} onClick={handleSave}>
            <FiSave /> Guardar cambios
          </Button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Datos del producto */}
        <Card className="p-6 lg:col-span-2">
          <CardHeader title="Información general" subtitle="Datos visibles en el catálogo público." />
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Título" className="sm:col-span-2">
              <input className="admin-input" value={product.title || ""} onChange={set("title")} />
            </Field>
            <Field label="Categoría">
              <input className="admin-input" value={product.category || ""} onChange={set("category")} />
            </Field>
            <Field label="Precio (USD)">
              <input type="number" min="0" step="0.01" className="admin-input" value={product.price ?? ""} onChange={set("price")} />
            </Field>
            <Field label="Descripción" className="sm:col-span-2">
              <textarea rows={5} className="admin-input resize-y" value={product.description || ""} onChange={set("description")} />
            </Field>
          </div>
        </Card>

        {/* Imagen */}
        <Card className="h-fit p-6">
          <CardHeader title="Imagen" subtitle="URL de la imagen del producto." />
          <div className="flex h-64 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-4">
            {product.image ? (
              <img src={product.image} alt={product.title} className="h-full w-full object-contain" />
            ) : (
              <FiImage className="text-4xl text-slate-300" />
            )}
          </div>
          <Field label="URL de imagen" className="mt-4">
            <input
              className="admin-input"
              value={product.image || ""}
              onChange={set("image")}
              placeholder="https://..."
            />
          </Field>
          <Button loading={saving} onClick={handleSave} className="mt-4 w-full">
            <FiSave /> Guardar cambios
          </Button>
        </Card>
      </div>
    </LayoutAdmin>
  );
};

export default Product;
