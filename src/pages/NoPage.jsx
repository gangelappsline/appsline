import { NavLink } from "react-router-dom";

const NoPage = () => {

    return(
        <>
        <div className="w-full min-h-screen flex flex-col justify-center items-center">
            <h1 className="text-2xl">Not Found</h1>
            <NavLink to="/">Home</NavLink>
        </div>
        </>
    )
}

export default NoPage;