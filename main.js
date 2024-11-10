const PROCESSED = Symbol("walker processed");

const TEXT_REPLACEMENTS = [
  {re: /Donald Trump/gi, to: 'Orange Man'},
  {re: /Trump/gi, to: 'Orange Man'}, // maybe strumpet.
  {re: /Elon Musk/gi, to: 'Some Guy'},
  {re: /Elon/gi, to: 'Some Guy'},
  {re: /Musk/gi, to: 'Some Guy'},
  {re: /RFK/gi, to: 'Wormtail'},
  {re: /Kennedy/gi, to: 'Wormtail'},
  {re: /JD Vance/gi, to: 'Sofa King'},
  {re: /J\.D\. Vance/gi, to: 'Sofa King'},
  {re: /Vance/gi, to: 'Sofa King'}, // maybe advancement
  {re: /Make America Great Again/gi, to: 'Cult Membership'},
]


function performTextHole(text) {
  let txt = text || "";
  for (const replacement of TEXT_REPLACEMENTS) {
    txt = txt.replaceAll(replacement.re, replacement.to);
  }
  return txt;
}

function shouldHole(text) {
  // just if any will match, some should short circuit and not excute them all.
  return TEXT_REPLACEMENTS.some(replacement => replacement.re.test(text));
}

function performImageHole(img) {
  if (img[PROCESSED]) {
    return;
  }
  img.classList.add("memoryholed");
  img[PROCESSED] = true;

}

function holeSimilarLinks(global, node) {
  // find a link
  const link = node.closest("a");
  if (link) {
    const href = link.getAttribute("href");
    if (href) {
      // find all of the similar links
      const similar = global.document.querySelectorAll(`a[href="${href}"]`);
      for (const sim of similar) {
        if (sim[PROCESSED]) {
          continue;
        }

        sim[PROCESSED] = true;
        sim.setAttribute("data-original-href", href);
        sim.setAttribute("href", "#");
        // Images that are within links but weren't identified before.
        // Be better, use alt text people!
        const imgs = sim.querySelectorAll("img");
        for (const img of imgs) {
          performImageHole(img);
        }
      }
    }
  }
}

function performMemoryHole(global) {
  // walk everything looking for the thing to memory hole
  const textWalker = global.document.createTreeWalker(global.document, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node[PROCESSED]) {
        return NodeFilter.FILTER_SKIP;
      }
      return shouldHole(node.textContent) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });

    
  while (textWalker.nextNode()) {
    const node = textWalker.currentNode;
    // mark the node as processed so it isn't scanned again
    node[PROCESSED] = true;
    // replace the string
    node.textContent = performTextHole(node.textContent);
    // Find everything that shares a link
    holeSimilarLinks(global, node.parentElement);
  }

  // images are also problematic
  const imgWalker = global.document.createTreeWalker(global.document, NodeFilter.SHOW_ELEMENT, {
    acceptNode(node) {
      if (node[PROCESSED]) {
        // skip Just this node, still process its children.
        return NodeFilter.FILTER_REJECT;
      }
      // TODO, support for picture and figure?
      if (node.nodeName.toLowerCase() !== "img") {
        return NodeFilter.FILTER_SKIP
      }
      // TODO: support for source sets.
      // This will only ever really match single word regexs, but better than nothing.
      if (shouldHole(node.getAttribute("src"))) {
        return NodeFilter.FILTER_ACCEPT;
      }
      // Alt text for sure since news sources should alt text everything.
      return shouldHole(node.getAttribute("alt")) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });
  
  // TODO: Veeery similar to the above, so is the walker for that matter, could maybe refactor?
  while (imgWalker.nextNode()) {
    const node = imgWalker.currentNode;
    // mark the node as processed so it isn't scanned again
    node[PROCESSED] = true;
    // replace the image
    performImageHole(node);
    // Find everything that shares a link
    holeSimilarLinks(global, node);
  }
}


// Actually initialize
((global) => {
  // watch the whole dom for node changes that might contain the text.
  const options = {
    subtree: true,
    childList: true,
  }
  const observer = new MutationObserver((mutationList) => {
    // schedule this to happen on the next tick since it appears the mutation observer doesn't
    // seem to be capturing some final image additions on bsky
    setTimeout(() => {
      // could probably just target the things that mutated, but for now hamfistedly re-walk the whole tree.
      performMemoryHole(global);
    }, 0);
  });
  observer.observe(global.document, options);
  
  // just perform an initial pass for essentially static sites.
  performMemoryHole(global);
})(globalThis);