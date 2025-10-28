import { useEffect, useState } from "react";
import LayoutAdmin from "../../layouts/LayoutAdmin";
import axios from 'axios';
import { NavLink } from "react-router-dom";

const Products = () => {

    const apiUrl = import.meta.env.VITE_API_URL;

    const [products, setProducts] = useState([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.get(apiUrl + "/products");
                console.table(response)
                setProducts(response.data)
            } catch (error) {
                console.error('Error fetching Pokémon details:', error);
            } finally {
                //setLoading(false);
            }
        }

        fetchData();
    }, [])

    return (
        <>
            <LayoutAdmin>
                <div className="p-2 bg-white rounded-xl mb-4">
                    <h1>Products</h1>
                </div>
                <div className="w-full bg-white rounded-xl p-2">
                    <div className="overflow-x-auto">
                        <table className="mx-auto max-w-full w-full table-auto whitespace-nowrap rounded-lg bg-white divide-y divide-gray-300 overflow-hidden">
                            <thead className="bg-app-one">
                                <tr className="text-white text-left">
                                    <th className="font-semibold text-sm uppercase px-6 py-4"> Product </th>
                                    <th className="font-semibold text-sm uppercase px-6 py-4"> Description </th>
                                    <th className="font-semibold text-sm uppercase px-6 py-4"> Price </th>
                                    <th className="font-semibold text-sm uppercase px-6 py-4"> </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {products && products.map(product => (
                                    <tr key={"product-" + product.id} className="w-full">
                                        <td className="px-6 py-4 w-3/12">
                                            <div className="flex items-center space-x-3">
                                                <div className="inline-flex w-20 h-20">
                                                    <img className="w-20 h-20 object-cover rounded-lg" alt="User avatar" src={product.image} />
                                                </div>
                                                <div>
                                                    <p>{product.title}</p>
                                                    <p className="text-gray-500 text-sm font-semibold tracking-wide">{product.category}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center w-3/12"></td>
                                        <td className="px-6 py-4">
                                            <p>${product.price}</p>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <NavLink to={"/admin/products/" + product.id} className="text-purple-800 hover:underline">Edit</NavLink>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                </div>
            </LayoutAdmin>
        </>
    )
}

export default Products;