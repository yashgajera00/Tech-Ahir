import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createAuction } from '../api/auctions';

export default function CreateAuctionModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    starting_price: '',
    min_bid_increment: '',
    start_time: '',
    end_time: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function handleEscape(event) {
      if (event.key === 'Escape') onClose();
    }

    document.body.classList.add('modal-open');
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.body.classList.remove('modal-open');
      window.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  function updateField(event) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');

    const start = new Date(form.start_time);
    const end = new Date(form.end_time);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setError('Enter valid start and end times');
      return;
    }
    if (end <= start) {
      setError('End time must be after start time');
      return;
    }
    if (Number(form.starting_price) < 0) {
      setError('Starting price cannot be negative');
      return;
    }
    if (Number(form.min_bid_increment) <= 0) {
      setError('Minimum bid increment must be greater than zero');
      return;
    }

    setBusy(true);
    try {
      const auction = await createAuction({
        title: form.title,
        description: form.description,
        starting_price: Number(form.starting_price),
        min_bid_increment: Number(form.min_bid_increment),
        start_time: start.toISOString(),
        end_time: end.toISOString(),
      });
      setSuccess('Auction created successfully');
      window.setTimeout(() => onCreated(auction), 500);
    } catch (requestError) {
      const data = requestError.response?.data;
      setError(
        data?.details?.map((item) => item.message).join('. ') ||
          data?.error ||
          'Unable to create auction',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="create-auction-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-auction-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">New listing</p>
            <h2 id="create-auction-title">Create auction</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close create auction modal"
          >
            <X size={20} />
          </button>
        </div>

        <form className="create-auction-form" onSubmit={submit}>
          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <div className="form-grid">
            <label className="full-width">
              Title
              <input
                name="title"
                value={form.title}
                onChange={updateField}
                placeholder="Vintage camera"
                minLength={3}
                maxLength={160}
                required
              />
            </label>

            <label className="full-width">
              Description
              <textarea
                name="description"
                value={form.description}
                onChange={updateField}
                placeholder="Describe the item, condition, and included accessories"
                maxLength={5000}
                rows={4}
              />
            </label>

            <label>
              Starting price
              <div className="input-prefix">
                <span>$</span>
                <input
                  name="starting_price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.starting_price}
                  onChange={updateField}
                  placeholder="100.00"
                  required
                />
              </div>
            </label>

            <label>
              Minimum bid increment
              <div className="input-prefix">
                <span>$</span>
                <input
                  name="min_bid_increment"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.min_bid_increment}
                  onChange={updateField}
                  placeholder="10.00"
                  required
                />
              </div>
            </label>

            <label>
              Start date and time
              <input
                name="start_time"
                type="datetime-local"
                value={form.start_time}
                onChange={updateField}
                required
              />
            </label>

            <label>
              End date and time
              <input
                name="end_time"
                type="datetime-local"
                value={form.end_time}
                onChange={updateField}
                required
              />
            </label>
          </div>

          <div className="form-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary-button" type="submit" disabled={busy}>
              {busy ? 'Creating...' : 'Create auction'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
