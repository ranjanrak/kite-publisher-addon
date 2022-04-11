# kite-publisher-addon
[Kite publisher](https://kite.trade/docs/connect/v3/publisher/) implementation with window popup status addon.

## Installation
```
git clone https://github.com/ranjanrak/kite-publisher-addon.git
```

## Usage

```js
<!-- The basket will be linked to this element's onClick //-->
<button id="custom-button">Buy the basket</button>

<script>
    var _KITE_ROOT = "https://kite.zerodha.com";
</script>

<!-- Include the plugin file//-->
<script src="publisher.js"></script>

<script>
// Only run your custom code once KiteConnect has fully initialised.
// Use KiteConnect.ready() to achieve this.
KiteConnect.ready(function() {
    // Initialize a new Kite instance.
    // You can initialize multiple instances if you need.
    var kite = new KiteConnect("your_api_key");

    // Add a stock to the basket
    kite.add({
    "variety": "regular",
    "tradingsymbol": "INFY",
    "exchange": "NSE",
    "transaction_type": "BUY",
    "order_type": "SL",
    "quantity": 10},
    {
    "variety": "regular",
    "tradingsymbol": "ONGC",
    "exchange": "BSE",
    "transaction_type": "BUY",
    "order_type": "MARKET",
    "quantity": 5},
    );

    // Register an (optional) callback.
    kite.finished(function(status, request_token) {
        alert("Finished. Status is " + status);
    });

    // addon
    // To get status for popup screen, if user directly closes it, 
    // without selecting either cancel or submit on basket popup window
    kite.winEvent(function(status) {
        alert("Popup window closed status is " + status);
    });

    // Render the in-built button inside a given target
    kite.renderButton("#default-button");

    // OR, link the basket to any existing element you want
    kite.link("#custom-button");
});
</script>
```