const TextArea = ({ name, placeholder='', value='', extraClasses, onChange}) =>{

    return (
        <>
        <textarea name={name} rows="6" className={"p-2 rounded-md border-2 border-gray-300 focus:border-app-two active:border-app-two "+extraClasses} placeholder={placeholder} value={value} onChange={onChange}></textarea>
        </>
    )
}

export default TextArea;