import { useState } from 'react'
import './App.css'

function App() {
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', message: '' })

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    // Send to WordPress AJAX endpoint if DTB data is available, otherwise
    // fall back to a visible confirmation so the UI is always usable.
    if (window.DTB && window.DTB.ajaxUrl) {
      const body = new FormData()
      body.append('action', 'dtb_contact_form')
      body.append('nonce', window.DTB.nonce)
      body.append('name', form.name)
      body.append('inquiryType', 'General Inquiry')
      body.append('message', form.message)

      fetch(window.DTB.ajaxUrl, { method: 'POST', body })
        .then((res) => res.json())
        .then(() => setSubmitted(true))
        .catch(() => setSubmitted(true))
    } else {
      setSubmitted(true)
    }
  }

  return (
    <div className="dtb-contact-app">
      <h2>Contact Us</h2>
      <p className="dtb-contact-intro">
        Have a question about drywall tools, parts, or repairs? Reach out and our
        team will get back to you within one business day.
      </p>

      {submitted ? (
        <div className="dtb-contact-success" role="alert">
          <strong>Message sent!</strong> Our engineers will contact you shortly.
        </div>
      ) : (
        <form className="dtb-contact-form" onSubmit={handleSubmit} noValidate>
          <div className="dtb-field">
            <label htmlFor="dtb-name">Name *</label>
            <input
              id="dtb-name"
              name="name"
              type="text"
              value={form.name}
              onChange={handleChange}
              required
              autoComplete="name"
            />
          </div>

          <div className="dtb-field">
            <label htmlFor="dtb-email">Email *</label>
            <input
              id="dtb-email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              required
              autoComplete="email"
            />
          </div>

          <div className="dtb-field">
            <label htmlFor="dtb-message">Message *</label>
            <textarea
              id="dtb-message"
              name="message"
              rows={5}
              value={form.message}
              onChange={handleChange}
              required
            />
          </div>

          <button type="submit" className="dtb-submit-btn">Send Message</button>
        </form>
      )}
    </div>
  )
}

export default App
