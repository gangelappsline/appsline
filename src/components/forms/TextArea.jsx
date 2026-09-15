const TextArea = ({ name, placeholder = '', value = '', extraClasses = '', onChange }) => {
    return (
        <textarea
            name={name}
            rows="6"
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            className={`admin-input resize-y ${extraClasses}`}
        ></textarea>
    );
};

export default TextArea;
