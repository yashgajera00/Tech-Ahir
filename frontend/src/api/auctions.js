import { api } from './client';

export async function createAuction(payload) {
  const { data } = await api.post('/auctions', payload);
  return data.auction;
}

export async function getAuctions(params = {}) {
  const { data } = await api.get('/auctions', { params });
  return data;
}

export async function getAuction(id) {
  const { data } = await api.get(`/auctions/${id}`);
  return data.auction;
}

export async function getMyAuctions(params = {}) {
  const { data } = await api.get('/auctions/my', { params });
  return data;
}

export async function placeBid(auctionId, payload) {
  const { data } = await api.post(`/auctions/${auctionId}/bids`, payload);
  return data;
}

export async function getBidHistory(auctionId, params = {}) {
  const { data } = await api.get(`/auctions/${auctionId}/bids`, { params });
  return data;
}

export async function getAuctionResult(auctionId) {
  const { data } = await api.get(`/auctions/${auctionId}/result`);
  return data;
}
