import { NavLink, useParams } from "react-router-dom";
import LayoutAdmin from "../../layouts/LayoutAdmin";
import { useEffect, useState } from "react";
import Input from "../../components/forms/Input";
import TextArea from "../../components/forms/TextArea";
import IndeterminateLineBar from "../../components/IndeterminateLineBar";
import api from "../../services/api";

const Product = () => {

    const { id } = useParams();
    const [product, setProduct] = useState(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await api.get("/products/" + id);
                const payload = response.data;
                setProduct(payload?.data ?? payload ?? null);
            } catch (error) {
                console.error('Error fetching product details:', error);
            } finally {
                setIsLoading(false)
            }
        }

        fetchData();
    }, [id])

    if (isLoading) {
        return (
            <LayoutAdmin>
                <div className="flex justify-center items-center h-screen">
                    <IndeterminateLineBar />
                    {/*<div className="animate-spin inline-block size-28 border-[3px] border-current border-t-transparent text-blue-600 rounded-full dark:text-blue-500" role="status" aria-label="loading">
                        <span className="sr-only">Loading...</span>
                    </div>*/}
                </div>
            </LayoutAdmin>
        );
    }

    // Si el producto no existe (por algún error en la API o ID incorrecto)
    if (!product) {
        return (
            <LayoutAdmin>
                <div className="flex justify-center items-center h-screen">
                    <h1>Product not found</h1>
                </div>
            </LayoutAdmin>
        );
    }
    return (
        <>
            <LayoutAdmin>
                <div className="p-2 bg-white rounded-xl mb-4">
                    <h1>{product.title}</h1>
                </div>
                <div className="w-full bg-white rounded-xl p-2">
                    <div className="overflow-x-auto">
                        <div className="w-full grid grid-cols-12 gap-6">
                            <div className="col-span-8 grid grid-cols-2 gap-6">
                                <div className="gap-2 flex flex-col">
                                    <label htmlFor="title" className="font-semibold">Title</label>
                                    <Input name="title" type="text" value={product.title} onChange={(e) => console.log(e.target.value)} />
                                </div>
                                <div className="gap-2 flex flex-col">
                                    <label htmlFor="category" className="font-semibold">Category</label>
                                    <Input name="category" type="text" value={product.category} onChange={(e) => console.log(e.target.value)} />
                                </div>
                                <div className="gap-2 flex flex-col">
                                    <label htmlFor="price" className="font-semibold">Price</label>
                                    <Input name="price" type="number" value={product.price} onChange={(e) => console.log(e.target.value)} />
                                </div>
                                <div className="gap-2 flex flex-col">
                                    <label htmlFor="price" className="font-semibold">Rate</label>
                                    <Input name="rate" type="number" value={product.rating?.rate ?? ''} onChange={(e) => console.log(e.target.value)} />
                                </div>
                                <div className="col-span-2 flex flex-col gap-2">
                                    <label htmlFor="category" className="font-semibold">Description</label>
                                    <TextArea name="description" value={product.description} />
                                </div>
                            </div>
                            <div className="col-span-4">
                                <div className="w-full h-72 gap-2 flex flex-col">
                                    <label htmlFor="price" className="font-semibold">Image</label>
                                    <img src={product.image} alt="" className="object-cover h-72 rounded-lg" />
                                </div>
                            </div>
                            <div className="col-span-12 flex gap-6 justify-center items-center w-full">
                                <NavLink to="/admin/products" className="px-4 py-2 rounded-lg bg-gray-300 text-black">Back</NavLink>
                                <button className="px-4 py-2 rounded-lg bg-app-one text-white">Update</button>
                            </div>
                        </div>
                    </div>
                </div>
            </LayoutAdmin>
        </>
    )
}

export default Product;