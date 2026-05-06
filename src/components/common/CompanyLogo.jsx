const CompanyLogo = ({ className = "h-8 w-8" }) => (
  <img
    src="MAGNETIC (3).png"
    alt="Logo da Empresa"
    className={className}
    onError={(e) => {
      e.target.onerror = null;
      e.target.src = 'https://ui-avatars.com/api/?name=Magnetic+Place&background=4f46e5&color=fff';
    }}
  />
);

export default CompanyLogo;