import yfinance as yf
news = yf.Ticker('AAPL').news
print(f"Found {len(news)} items")
for i, n in enumerate(news[:3]):
    c = n.get('content', n)
    ctu = c.get('clickThroughUrl')
    can = c.get('canonicalUrl')
    link = c.get('link')
    print(f"Item {i}:")
    print(f"  CTU Type: {type(ctu)}")
    print(f"  CTU Value: {ctu}")
    print(f"  CAN Type: {type(can)}")
    print(f"  CAN Value: {can}")
    print(f"  LINK Type: {type(link)}")
    print(f"  LINK Value: {link}")
    print("-" * 20)
