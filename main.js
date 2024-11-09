const PROCESSED = Symbol("walker processed");

const TEXT_REPLACEMENTS = [
  {re: /Donald Trump/gi, to: 'Orange Man'},
  {re: /Trump/gi, to: 'Orange Man'},
  {re: /Elon Musk/gi, to: 'Some Guy'},
  {re: /Elon/gi, to: 'Some Guy'},
  {re: /Musk/gi, to: 'Some Guy'},
  {re: /RFK/gi, to: 'Wormtail'},
  {re: /Kennedy/gi, to: 'Wormtail'},
  {re: /JD Vance/gi, to: 'Sofa King'},
  {re: /J\.D\. Vance/gi, to: 'Sofa King'},
  {re: /Vance/gi, to: 'Sofa King'},
]


function performTextHole(text) {
  let txt = text || "";
  for (const replacement of TEXT_REPLACEMENTS) {
    text = text.replaceAll(replacement.re, replacement.to);
  }
  return text;
}

function shouldHole(text) {
  // just if any will match, some should short circuit and not excute them all.
  return TEXT_REPLACEMENTS.some(replacement => replacement.re.test(text));
}

function performImageHole(img) {
  if (img[PROCESSED]) {
    return;
  }
  img.setAttribute("style", "filter: blur(1em);");
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
        // make the link not work
        sim.setAttribute("data-original-href", href);
        sim.setAttribute("href", "#");
        // Mayyyybe there are images that weren't caught previously, blur them too?
        // Be better
        for (const img of sim.querySelectorAll("img")) {
          performImageHole(img);
        }
        sim[PROCESSED] = true;
      }
    }
  }
}

async function performMemoryHole(global) {
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
        return NodeFilter.FILTER_REJECT;
      }
      // TODO, support for picture and figure?
      if (node.nodeName.toLowerCase() !== "img") {
        return NodeFilter.FILTER_SKIP
      }
      // Alt text for sure since news sources should alt text everything.  Maybe SRCs too?
      // TODO: support for source sets.
      if (shouldHole(node.getAttribute("src"))) {
        return NodeFilter.FILTER_ACCEPT;
      }
      return shouldHole(node.getAttribute("alt")) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });
  
  // TODD: Veeery similar to the above, so is the walker for that matter, could maybe refactor.
  while (imgWalker.nextNode()) {
    const node = imgWalker.currentNode;
    // mark the node as processed so it isn't scanned again
    console.log(node);
    node[PROCESSED] = true;
    // replace the image
    performImageHole(node);
    // Find everything that shares a link
    holeSimilarLinks(global, node);
  }
}


// Actually initialize
(async (global) => {
  // watch the whole dom for node changes that might contain the text.
  const options = {
    subtree: true,
    childTree: true,
  }
  const observer = new MutationObserver(async (mutationList) => {
    // could probably just target the things that mutated, but for now hamfistedly walk the whole tree.
    await performMemoryHole(global);
  });
  
  await performMemoryHole(global);
})(globalThis);