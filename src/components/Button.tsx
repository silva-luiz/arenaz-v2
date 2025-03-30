interface IButton {
  text: string;
  className: string;
  handleClick?: (e: any) => Promise<void>;
}

const Button = ({ text, className, handleClick }: IButton) => {
  return (
    <button className={className} onClick={handleClick}>
      {text}
    </button>
  );
};

export default Button;
