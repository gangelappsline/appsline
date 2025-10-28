const Input = ({type, name, placeholder='', value='', extraClasses, onChange}) =>{
    return (
        <>
        <input name={name} className={"p-2 pl-12 w-full rounded-md border-2 border-gray-300 focus:border-app-two active:border-app-twoleading-tight focus:outline-none focus:shadow-outline "+extraClasses} type={type} placeholder={placeholder} value={value} onChange={onChange}/>
        </>
    )
}

export default Input