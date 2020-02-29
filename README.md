# Raffle

Calculates odds of winning prizes in a raffle. This was written to
calculate the expected return from the UK
[NS&I premium bonds](https://www.nsandi.com/premium-bonds) scheme, but
can also be applied to any raffle where the prizes are primarily
defined by their monetary value.

[See it in action!](https://davidje13.github.io/Raffle/)

This project includes a web page for visualising results, but the core
logic is available as a component which can be included in other
projects under the LGPL license.

## Browser Support

Due to the use of Web Workers and modern Javascript syntax, this will
only work in modern browsers (Chrome / Safari / FireFox). It may or may
not work in Edge and almost certainly will not work in Internet
Explorer.

## Local Development

To run this project locally, you will need to start a localhost server.
If you have nodejs installed, this can be done with a simple command:

```sh
npm start
```

(a localhost server is required because Web Workers cannot be served
from the filesystem in all browsers)

### WebAssembly

This project uses C for its core logic (compiled to WebAssembly). To change the
C code, you will need to install emscripten:

```sh
brew install emscripten binaryen

# bugfix, see https://github.com/Homebrew/homebrew-core/issues/47869
echo "BINARYEN_ROOT = '/usr/local'" >> ~/.emscripten
```

You can also install helpers (e.g. `wasm2wat`) with:

```sh
brew install wabt
```

To rebuild the WebAssembly files, run:

```sh
npm run build
```

### Testing

There is also a suite of Jasmine tests (`spec/**/*.spec.js`) and a
linter which can be run with:

```sh
npm run test            # run Jasmine tests
npm run lint            # run linter
npm run check           # run linter and tests
```

## Using the Library

```javascript
// First, build a raffle with prizes and a total audience size:

const raffle = new Raffle({
  audience: 100,
  prizes: [
    {count:  2, value: 1000},
    {count: 10, value:  100},
    {count: 20, value:   10},
  ],
  pCutoff: 1e-10, // Optimisation (defaults to 0)
});

// Now enter the raffle with a number of tickets:

raffle.enter(5).then((results) => {
  console.log('Tickets: ' + results.tickets());
  console.log('Audience: ' + raffle.audience());
  console.log(
    'Prize range: £' + results.min().toFixed(2) +
    ' - £' + results.max().toFixed(2)
  );
  console.log('Median winnings: £' + results.median());

  for(let i = results.min(); i <= results.max(); ++ i) {
    const pE = results.exact_probability(i);
    if(pE < 0.00000001) {
      continue;
    }
    const pR = results.range_probability(i, Number.POSITIVE_INFINITY);
    console.log(
      '= £' + i.toFixed(2) + ': ' +
      (pE * 100).toFixed(4) + '%' +
      ' >= £' + i.toFixed(2) + ': ' +
      (pR * 100).toFixed(4) + '%'
    );
  }
});

// We can enter the same raffle any number of times.
// All results will be independent:

raffle.enter(2).then((results) => {
  // ...
});
```

## Explanation

### Theory

To calculate the probabilities, all distributions of prizes are
simulated (with a configurable cutoff for incredibly unlikely outcomes
for performance reasons). The process is:

1. Clean up the prize list (e.g. by combining prizes of the same value)

2. Add 0-value prizes to the prize list so that every entry will win
   something (even if its worth is 0)

3. Sort the prize list from the rarest to the most common. This is not
   strictly required but provides a large performance boost in the
   later stages by keeping the matrices sparse.

4. Construct a nested array structure. This represents a sparse matrix
   where the primary ("vertical") dimension represents the number of
   spent tickets so far, and the secondary ("horizontal") dimension is
   the total value won so far. The elements of the matrix store the
   probability of this situation. Initially, only the element [0,0] has
   a value (1).

   _note: a nested array structure is used so that the next stages can
   run more efficiently._

5. For each prize (from rarest to most common), iterate down the matrix
   (all tickets spent to no tickets spent). At each of these rows,
   calculate the probabilities of winning different quantities of the
   current prize (e.g. if we are at row 8 of 10, we have 2 tickets
   remaining, so we can calculate how likely we are to win 0, 1 or 2 of
   the current prize). Once these probabilities are known, use them to
   add entries to the rows above the current row (i.e. 1 more ticket
   spent => value of 1 prize, with current probability * odds of
   winning, then same for 2, 3, etc.).

   _note: in this implementation, a shortcut is taken for the final
   (most common) prize, since once that stage has completed we will
   only care about a small part of the matrix._

6. Read out the probabilities for each monetary value from the top row
   of the matrix (corresponding to all tickets spent).

7. Apply post-processing (store probabilities as cumulative
   probabilities and reduce rounding errors by normalising to [0 1])

To calculate the probability of winning an individual prize (step 5),
the equation used is:

```
(targets C n) * ((total - targets) C (samples - n))
---------------------------------------------------
                 total C samples
```

Where `n C k` represents the binomial coefficient:

```
             n!
n C k = -------------
        k! * (n - k)!
```

Since these factorials lead to very large numbers, these calculations
are performed in log space, using Stirling's log-gamma approximation.

### Code

Steps 1-3 above are performed when creating a `Raffle` object, and the
result is stored. When `enter` is called, steps 4-7 are performed in
a worker thread (code for this is in raffle_worker.js). The result is
stored in a `Result` object which is returned. This `Result` object
has various convenience methods for reading the probabilities.
