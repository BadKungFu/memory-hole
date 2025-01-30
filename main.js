const PROCESSED = Symbol("walker processed");

const TEXT_REPLACEMENTS = [
  {
    re: /(?<![a-z])(donald j\. trump|donald j trump|donald trump|trump)(?![a-z])/gi,
    to: "Orange Man",
  },
  {
    re: /(?<![a-z])(elon musk|elon|musk)(?![a-z])/gi,
    to: "Some Guy",
  },
  {
    re: /(?<![a-z])(robert f\. kennedy|rfk|kennedy)(?![a-z])/gi,
    to: "Worm Brain",
  },
  {
    re: /(?<![a-z])(j\.d\. vance|jd vance|vance)(?![a-z])/gi,
    to: "Sofa King",
  },
  {
    re: /(?<![a-z])(make america great again|maga)(?![a-z])/gi,
    to: "Death Cult",
  },
];

function performTextHole(text) {
  let txt = text || "";
  for (const replacement of TEXT_REPLACEMENTS) {
    txt = txt.replaceAll(replacement.re, replacement.to);
  }
  return txt;
}

function shouldHole(text) {
  // just if any will match, some should short circuit and not excute them all.
  return TEXT_REPLACEMENTS.some((replacement) => replacement.re.test(text));
}

function applyHolingScope(node) {
  if (node[PROCESSED]) {
    return;
  }
  // Would prefer to use a class so we don't have to use an attribute selector but
  // classlists are often paved over by various frameworks whereas the custom attribute
  // won't be.
  if (node.setAttribute) {
    node.setAttribute("data-memoryholed", "true");
  }
  node[PROCESSED] = true;
}

function handleHoledLinkClick(evt) {
  const node = evt.currentTarget;
  if (node && node.getAttribute("data-original-href")) {
    if (confirm("Restore Link?")) {
      node.setAttribute("href", node.getAttribute("data-original-href"));
      node.removeAttribute("data-original-href");
      node.removeEventListener("click", handleHoledLinkClick);
    }
  }
  evt.preventDefault();
}

function expandHoleScope(global, node) {
  // See if this is contained in a link and then hole that link and any others with the same href.
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

        // Allow you to opt out of memory hole-ing a link.
        sim.setAttribute("data-original-href", href);
        sim.setAttribute("href", "#");
        sim.addEventListener("click", handleHoledLinkClick, {
          capture: true,
        });

        applyHolingScope(sim);
      }
    }
  }
  // See if this is in an article tag, just hole the tag
  const article = node.closest("li, article");
  if (article) {
    // Maybe check bounding rect?
    applyHolingScope(article);
  }
}

function performMemoryHole(global) {
  // walk everything looking for the thing to memory hole
  const textWalker = global.document.createTreeWalker(
    global.document,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (node[PROCESSED]) {
          return NodeFilter.FILTER_SKIP;
        }
        return shouldHole(node.textContent)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      },
    }
  );

  while (textWalker.nextNode()) {
    const node = textWalker.currentNode;
    // replace the string
    node.textContent = performTextHole(node.textContent);
    // Find surrounding links and articles
    expandHoleScope(global, node.parentElement);
    // mark the node as processed so it isn't scanned again
    node[PROCESSED] = true;
  }

  // images are also problematic in and of themselves
  const imgWalker = global.document.createTreeWalker(
    global.document,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode(node) {
        if (node[PROCESSED]) {
          // skip Just this node, still process its children.
          return NodeFilter.FILTER_SKIP;
        }
        // TODO, support for picture and figure?
        if (node.nodeName.toLowerCase() !== "img") {
          return NodeFilter.FILTER_SKIP;
        }
        // TODO: support for source sets.
        // This will only ever really match single word regexs, but better than nothing.
        if (shouldHole(node.getAttribute("src"))) {
          return NodeFilter.FILTER_ACCEPT;
        }
        // Alt text for sure since news sources should alt text everything.
        return shouldHole(node.getAttribute("alt"))
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP;
      },
    }
  );

  // TODO: Veeery similar to the above, so is the walker for that matter, could maybe refactor?
  while (imgWalker.nextNode()) {
    const node = imgWalker.currentNode;
    // Directly mark this image
    applyHolingScope(node);
    // Find surrounding links and articles
    expandHoleScope(global, node);
    // mark the node as processed so it isn't scanned again
    node[PROCESSED] = true;
  }
}

// Actually initialize
((global) => {
  // watch the whole dom for node changes that might contain the text.
  const options = {
    subtree: true,
    childList: true,
  };
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
