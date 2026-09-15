const Input = ({ type, name, placeholder = '', value = '', extraClasses = '', onChange }) => {
    return (
        <input
            name={name}
            type={type}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            className={`admin-input ${extraClasses}`}
        />
    );
};

export default Input;
