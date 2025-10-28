import { useEffect } from "react";
import Footer from "../components/Footer";
import Header from "../components/Header";
import { useParams } from "react-router-dom";

const Layout = ({title, children}) =>{

    const AppName = 'Appsline';

    //const {title} = useParams();

    useEffect(() => {
        document.title = AppName +" "+title;
      }, []);

    return (
        <>
        <Header/>
        <main>{children}</main>
        <Footer/>
        </>
    )
}

export default Layout;