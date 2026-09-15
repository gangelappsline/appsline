import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../layouts/Layout";

const ProjectLead = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    tipo_proyecto: "",
    nombre: "",
    email: "",
    telefono: "",
    empresa: "",
    descripcion_proyecto: "",
    tiempo_estimado: "",
    presupuesto: "",
    usuarios_estimados: "",
    fecha_videollamada: "",
    hora_videollamada: "",
  });

  const projectTypes = [
    {
      key: "ERP",
      title: "ERP",
      description: "Sistema de gestión empresarial que integra procesos de inventario, ventas, contabilidad y recursos humanos.",
      icon: "🏢"
    },
    {
      key: "CRM",
      title: "CRM",
      description: "Sistema para gestionar clientes, ventas, contactos y oportunidades.",
      icon: "👥"
    },
    {
      key: "POS",
      title: "POS",
      description: "Sistema de punto de venta para registrar ventas, controlar inventario y generar reportes.",
      icon: "💳"
    },
    {
      key: "E-Commerce",
      title: "E-Commerce",
      description: "Tienda en línea con carrito, pagos, catálogo y gestión de pedidos.",
      icon: "🛒"
    },
    {
      key: "App Web Personalizada",
      title: "App Web Personalizada",
      description: "Desarrollo a medida según requerimientos específicos.",
      icon: "⚡"
    },
    {
      key: "Otro",
      title: "Otro",
      description: "Si tu proyecto no se encuentra en las opciones anteriores.",
      icon: "💡"
    }
  ];

  const timeOptions = [
    "Lo antes posible",
    "En menos de 1 mes",
    "Entre 1 y 3 meses",
    "Más de 3 meses"
  ];

  const budgetOptions = [
    "Menos de $20,000 MXN",
    "$20,000 - $50,000 MXN",
    "$50,000 - $100,000 MXN",
    "Más de $100,000 MXN"
  ];

  // Generar horas disponibles de 9:00 a 18:00 con intervalos de 30 min
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 9; hour <= 17; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      if (hour < 17) {
        slots.push(`${hour.toString().padStart(2, '0')}:30`);
      }
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleProjectTypeSelect = (type) => {
    setFormData(prev => ({
      ...prev,
      tipo_proyecto: type
    }));
  };

  const validateForm = () => {
    const required = ['tipo_proyecto', 'nombre', 'email', 'fecha_videollamada', 'hora_videollamada'];
    return required.every(field => formData[field]?.trim());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      alert("Por favor, completa todos los campos obligatorios.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("https://api.appsline.com.mx/api/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          usuarios_estimados: formData.usuarios_estimados ? parseInt(formData.usuarios_estimados) : null
        }),
      });

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          navigate("/");
        }, 3000);
      } else {
        throw new Error("Error al enviar el formulario");
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Hubo un error al enviar tu información. Por favor, intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Layout title="¡Gracias por tu interés!">
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center px-4">
          <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Solicitud Enviada!</h2>
            <p className="text-gray-600 mb-4">
              Gracias por tu interés. Nos pondremos en contacto contigo muy pronto para agendar tu videollamada.
            </p>
            <p className="text-sm text-gray-500">Serás redirigido al inicio en unos segundos...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Solicita tu Proyecto Personalizado">
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Convierte tu <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-700 to-brand-400">idea en realidad</span>
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Completa este formulario y agendemos una videollamada gratuita para discutir tu proyecto personalizado.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-8 space-y-8">
            {/* Selección de tipo de proyecto */}
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                ¿Qué tipo de proyecto necesitas? *
              </h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projectTypes.map((project) => (
                  <div
                    key={project.key}
                    onClick={() => handleProjectTypeSelect(project.key)}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md ${
                      formData.tipo_proyecto === project.key
                        ? "border-brand-500 bg-brand-50"
                        : "border-slate-200 hover:border-brand-300"
                    }`}
                  >
                    <div className="text-3xl mb-2">{project.icon}</div>
                    <h4 className="font-semibold text-gray-900 mb-1">{project.title}</h4>
                    <p className="text-sm text-gray-600">{project.description}</p>
                  </div>
                ))}
              </div>
              
              {formData.tipo_proyecto === "Otro" && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Especifica tu proyecto:
                  </label>
                  <input
                    type="text"
                    name="otro_proyecto"
                    value={formData.otro_proyecto || ""}
                    onChange={handleInputChange}
                    className="admin-input"
                    placeholder="Describe brevemente tu proyecto..."
                  />
                </div>
              )}
            </div>

            {/* Información personal */}
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Información de contacto</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre completo *
                  </label>
                  <input
                    type="text"
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleInputChange}
                    required
                    className="admin-input"
                    placeholder="Tu nombre completo"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Correo electrónico *
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="admin-input"
                    placeholder="tu@email.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    name="telefono"
                    value={formData.telefono}
                    onChange={handleInputChange}
                    className="admin-input"
                    placeholder="55 1234 5678"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Empresa o negocio
                  </label>
                  <input
                    type="text"
                    name="empresa"
                    value={formData.empresa}
                    onChange={handleInputChange}
                    className="admin-input"
                    placeholder="Nombre de tu empresa"
                  />
                </div>
              </div>

              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción breve del proyecto
                </label>
                <textarea
                  name="descripcion_proyecto"
                  value={formData.descripcion_proyecto}
                  onChange={handleInputChange}
                  rows={4}
                  className="admin-input"
                  placeholder="Cuéntanos más detalles sobre lo que necesitas..."
                />
              </div>
            </div>

            {/* Requerimientos adicionales */}
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Requerimientos del proyecto</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tiempo estimado requerido
                  </label>
                  <select
                    name="tiempo_estimado"
                    value={formData.tiempo_estimado}
                    onChange={handleInputChange}
                    className="admin-input"
                  >
                    <option value="">Selecciona una opción</option>
                    {timeOptions.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Presupuesto aproximado
                  </label>
                  <select
                    name="presupuesto"
                    value={formData.presupuesto}
                    onChange={handleInputChange}
                    className="admin-input"
                  >
                    <option value="">Selecciona un rango</option>
                    {budgetOptions.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Número estimado de usuarios
                  </label>
                  <input
                    type="number"
                    name="usuarios_estimados"
                    value={formData.usuarios_estimados}
                    onChange={handleInputChange}
                    min="1"
                    className="admin-input"
                    placeholder="¿Cuántas personas usarían el sistema?"
                  />
                </div>
              </div>
            </div>

            {/* Agenda de videollamada */}
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Agenda tu videollamada gratuita *</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fecha preferida *
                  </label>
                  <input
                    type="date"
                    name="fecha_videollamada"
                    value={formData.fecha_videollamada}
                    onChange={handleInputChange}
                    required
                    min={new Date().toISOString().split('T')[0]}
                    className="admin-input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hora preferida *
                  </label>
                  <select
                    name="hora_videollamada"
                    value={formData.hora_videollamada}
                    onChange={handleInputChange}
                    required
                    className="admin-input"
                  >
                    <option value="">Selecciona una hora</option>
                    {timeSlots.map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                * Horario disponible: Lunes a Viernes de 9:00 a 17:30 hrs (GMT-6)
              </p>
            </div>

            {/* Botón de envío */}
            <div className="pt-6">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-brand-700 to-brand-400 text-white py-4 px-8 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Enviando...
                  </div>
                ) : (
                  "Enviar Solicitud y Agendar Videollamada"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default ProjectLead;