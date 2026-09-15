import { NavLink, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { FiArrowLeft, FiImage, FiSave } from "react-icons/fi";
import LayoutAdmin from "../../layouts/LayoutAdmin";
import Input from "../../components/forms/Input";
import TextArea from "../../components/forms/TextArea";
import api from "../../services/api";

const Product = () => {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await api.get("/products/" + id);
        const payload = response.data;
        setProduct(payload?.data ?? payload ?? null);
      } catch (error) {
        console.error("Error fetching product details:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [id]);

  if (isLoading) {
    return (
      <LayoutAdmin title="Producto">
        <div className="admin-card p-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
                  <div className="h-11 w-full animate-pulse rounded-xl bg-slate-100" />
                </div>
              ))}
            </div>
            <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
          </div>
        </div>
      </LayoutAdmin>
    );
  }

  if (!product) {
    return (
      <LayoutAdmin title="Producto">
        <div className="admin-card p-16 text-center">
          <FiImage className="mx-auto text-4xl text-slate-300" />
          <h2 className="mt-4 text-lg font-semibold text-slate-800">
            Producto no encontrado
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            El producto que buscas no existe o fue eliminado.
          </p>
          <NavLink to="/admin/products" className="btn-secondary mt-6">
            <FiArrowLeft /> Volver a productos
          </NavLink>
        </div>
      </LayoutAdmin>
    );
  }

  return (
    <LayoutAdmin
      title={product.title}
      subtitle="Edita la información del producto"
      actions={
        <>
          <NavLink to="/admin/products" className="btn-secondary">
            <FiArrowLeft /> Volver
          </NavLink>
          <button type="button" className="btn-primary">
            <FiSave /> Guardar cambios
          </button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Datos del producto */}
        <section className="admin-card p-6 lg:col-span-2">
          <h2 className="text-base font-semibold text-slate-800">
            Información general
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Datos visibles en el catálogo público.
          </p>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="title" className="admin-label">
                Título
              </label>
              <Input
                name="title"
                type="text"
                value={product.title}
                onChange={(e) => console.log(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="category" className="admin-label">
                Categoría
              </label>
              <Input
                name="category"
                type="text"
                value={product.category}
                onChange={(e) => console.log(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="price" className="admin-label">
                Precio
              </label>
              <Input
                name="price"
                type="number"
                value={product.price}
                onChange={(e) => console.log(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="rate" className="admin-label">
                Calificación
              </label>
              <Input
                name="rate"
                type="number"
                value={product.rating?.rate ?? ""}
                onChange={(e) => console.log(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="description" className="admin-label">
                Descripción
              </label>
              <TextArea name="description" value={product.description} />
            </div>
          </div>
        </section>

        {/* Imagen */}
        <section className="admin-card h-fit p-6">
          <h2 className="text-base font-semibold text-slate-800">Imagen</h2>
          <p className="mt-1 text-sm text-slate-500">Vista previa actual.</p>
          <div className="mt-5 flex h-64 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-4">
            {product.image ? (
              <img
                src={product.image}
                alt={product.title}
                className="h-full w-full object-contain"
              />
            ) : (
              <FiImage className="text-4xl text-slate-300" />
            )}
          </div>
          <button type="button" className="btn-secondary mt-4 w-full">
            Cambiar imagen
          </button>
        </section>
      </div>
    </LayoutAdmin>
  );
};

export default Product;
