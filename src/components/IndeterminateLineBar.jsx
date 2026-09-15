const IndeterminateLineBar = () => {
    return (
        <div className="w-full">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-100">
                <div className="progress left-right h-full w-full bg-gradient-to-r from-brand-700 via-brand-500 to-brand-400"></div>
            </div>
        </div>
    );
};

export default IndeterminateLineBar;
