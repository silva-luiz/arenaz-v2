interface IButton {
  text: string;
  className: string;
  handleClick?: (e: any) => void | Promise<void>;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
}

const Button = ({ text, className, handleClick, type = 'button', disabled = false }: IButton) => {
  return (
    <button className={className} onClick={handleClick} type={type} disabled={disabled}>
      {text}
    </button>
  );
};

export default Button;
